package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

// ErrConflict reports a violated unique constraint, e.g. a duplicate name.
var ErrConflict = errors.New("conflict")

// ErrInvalidRef reports a score pointing at a subject or task that does not exist.
var ErrInvalidRef = errors.New("invalid reference")

type Store struct{ pool *pgxpool.Pool }

type Subject struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Note      string `json:"note"`
	Position  int    `json:"position"`
	Reference bool   `json:"reference"`
	// Size is a parameter count in billions, nil when unknown.
	Size     *float64 `json:"size"`
	Archived bool     `json:"archived"`
}

type Task struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
	Archived bool   `json:"archived"`
	SetID    int    `json:"set_id"`
}

type TaskSet struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

// A Score row exists as soon as a task is marked computed; Value stays nil until
// the number itself is known.
type Score struct {
	SubjectID int      `json:"subject_id"`
	TaskID    int      `json:"task_id"`
	Value     *float64 `json:"value"`
	Computed  bool     `json:"computed"`
}

func Open(ctx context.Context, dsn string) (*Store, error) {
	// The DB container may still be starting on a cold `compose up`.
	var pool *pgxpool.Pool
	var err error
	for i := 0; i < 30; i++ {
		pool, err = pgxpool.New(ctx, dsn)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return &Store{pool: pool}, nil
			}
			pool.Close()
		}
		time.Sleep(time.Second)
	}
	return nil, err
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS subjects (
			id       serial PRIMARY KEY,
			name      text NOT NULL UNIQUE,
			note      text NOT NULL DEFAULT '',
			position  integer NOT NULL DEFAULT 0,
			reference boolean NOT NULL DEFAULT false,
			size      double precision CHECK (size > 0),
			archived  boolean NOT NULL DEFAULT false
		);
		CREATE TABLE IF NOT EXISTS task_sets (
			id       serial PRIMARY KEY,
			name     text NOT NULL UNIQUE,
			position integer NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS tasks (
			id       serial PRIMARY KEY,
			name     text NOT NULL,
			position integer NOT NULL DEFAULT 0,
			archived boolean NOT NULL DEFAULT false,
			set_id   integer REFERENCES task_sets(id) ON DELETE CASCADE
		);
		CREATE TABLE IF NOT EXISTS scores (
			subject_id integer NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
			task_id    integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
			value      double precision CHECK (value >= 0 AND value <= 100),
			computed   boolean NOT NULL DEFAULT false,
			PRIMARY KEY (subject_id, task_id)
		);

		ALTER TABLE subjects ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
		ALTER TABLE subjects ADD COLUMN IF NOT EXISTS reference boolean NOT NULL DEFAULT false;
		ALTER TABLE subjects ADD COLUMN IF NOT EXISTS size double precision CHECK (size > 0);
		ALTER TABLE subjects ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
		ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
		ALTER TABLE tasks ADD COLUMN IF NOT EXISTS set_id integer REFERENCES task_sets(id) ON DELETE CASCADE;
		ALTER TABLE scores ALTER COLUMN value DROP NOT NULL;
		ALTER TABLE scores ADD COLUMN IF NOT EXISTS computed boolean NOT NULL DEFAULT false;

		-- Reordering always writes 1..n, so position 0 marks a row that never got one.
		UPDATE subjects SET position = id WHERE position = 0;
		UPDATE tasks SET position = id WHERE position = 0;
		UPDATE scores SET computed = true WHERE value IS NOT NULL AND NOT computed;

		-- Every task belongs to a set. Tasks from before sets existed join the first one,
		-- which keeps their ids and therefore every score already attached to them.
		INSERT INTO task_sets (name, position)
			SELECT 'Set 1', 1 WHERE NOT EXISTS (SELECT 1 FROM task_sets);
		UPDATE tasks SET set_id = (SELECT id FROM task_sets ORDER BY position, id LIMIT 1)
			WHERE set_id IS NULL;

		-- Names only have to be unique inside a set, so two sets can both have "Math".
		ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_name_key;
		CREATE UNIQUE INDEX IF NOT EXISTS tasks_set_name_key ON tasks (set_id, name);
		ALTER TABLE tasks ALTER COLUMN set_id SET NOT NULL;
	`)
	return err
}

// Subjects leaves the archive out unless withArchived is set; only an admin sees it.
func (s *Store) Subjects(ctx context.Context, withArchived bool) ([]Subject, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, note, position, reference, size, archived FROM subjects
		 WHERE $1 OR NOT archived ORDER BY position, id`, withArchived)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (Subject, error) {
		var v Subject
		return v, r.Scan(&v.ID, &v.Name, &v.Note, &v.Position, &v.Reference, &v.Size, &v.Archived)
	})
}

func (s *Store) CreateSubject(ctx context.Context, name, note string, reference bool, size *float64) (Subject, error) {
	v := Subject{Name: name, Note: note, Reference: reference, Size: size}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO subjects (name, note, position, reference, size)
		 VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM subjects), $3, $4)
		 RETURNING id, position`, name, note, reference, size).Scan(&v.ID, &v.Position)
	return v, wrap(err)
}

func (s *Store) UpdateSubject(ctx context.Context, id int, name, note string, reference bool, size *float64) (Subject, error) {
	v := Subject{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE subjects SET name = $2, note = $3, reference = $4, size = $5
		 WHERE id = $1 RETURNING name, note, position, reference, size`,
		id, name, note, reference, size).Scan(&v.Name, &v.Note, &v.Position, &v.Reference, &v.Size)
	return v, wrap(err)
}

// Restoring puts the row back at the end, since its old position was reused meanwhile.
func (s *Store) ArchiveSubject(ctx context.Context, id int, archived bool) (Subject, error) {
	v := Subject{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE subjects SET archived = $2, position = CASE WHEN $2 THEN position
		   ELSE (SELECT COALESCE(MAX(position), 0) + 1 FROM subjects WHERE NOT archived) END
		 WHERE id = $1 RETURNING name, note, position, reference, size, archived`,
		id, archived).Scan(&v.Name, &v.Note, &v.Position, &v.Reference, &v.Size, &v.Archived)
	return v, wrap(err)
}

func (s *Store) Tasks(ctx context.Context, withArchived bool) ([]Task, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, position, archived, set_id FROM tasks
		 WHERE $1 OR NOT archived ORDER BY position, id`, withArchived)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (Task, error) {
		var v Task
		return v, r.Scan(&v.ID, &v.Name, &v.Position, &v.Archived, &v.SetID)
	})
}

func (s *Store) TaskSets(ctx context.Context) ([]TaskSet, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, position FROM task_sets ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (TaskSet, error) {
		var v TaskSet
		return v, r.Scan(&v.ID, &v.Name, &v.Position)
	})
}

func (s *Store) CreateTaskSet(ctx context.Context, name string) (TaskSet, error) {
	v := TaskSet{Name: name}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO task_sets (name, position)
		 VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM task_sets))
		 RETURNING id, position`, name).Scan(&v.ID, &v.Position)
	return v, wrap(err)
}

func (s *Store) UpdateTaskSet(ctx context.Context, id int, name string) (TaskSet, error) {
	v := TaskSet{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE task_sets SET name = $2 WHERE id = $1 RETURNING name, position`,
		id, name).Scan(&v.Name, &v.Position)
	return v, wrap(err)
}

func (s *Store) CreateTask(ctx context.Context, setID int, name string) (Task, error) {
	v := Task{Name: name, SetID: setID}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO tasks (name, position, set_id)
		 VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE set_id = $2), $2)
		 RETURNING id, position`, name, setID).Scan(&v.ID, &v.Position)
	return v, wrap(err)
}

func (s *Store) UpdateTask(ctx context.Context, id int, name string) (Task, error) {
	v := Task{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE tasks SET name = $2 WHERE id = $1 RETURNING name, position, set_id`,
		id, name).Scan(&v.Name, &v.Position, &v.SetID)
	return v, wrap(err)
}

func (s *Store) ReorderSubjects(ctx context.Context, ids []int) error {
	return s.reorder(ctx, "subjects", ids)
}

func (s *Store) ReorderTasks(ctx context.Context, ids []int) error {
	return s.reorder(ctx, "tasks", ids)
}

func (s *Store) reorder(ctx context.Context, table string, ids []int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i, id := range ids {
		tag, err := tx.Exec(ctx, `UPDATE `+table+` SET position = $2 WHERE id = $1`, id, i+1)
		if err != nil {
			return wrap(err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) ArchiveTask(ctx context.Context, id int, archived bool) (Task, error) {
	v := Task{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE tasks SET archived = $2, position = CASE WHEN $2 THEN position
		   ELSE (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks t
		         WHERE NOT t.archived AND t.set_id = tasks.set_id) END
		 WHERE id = $1 RETURNING name, position, archived, set_id`,
		id, archived).Scan(&v.Name, &v.Position, &v.Archived, &v.SetID)
	return v, wrap(err)
}

func (s *Store) Scores(ctx context.Context) ([]Score, error) {
	rows, err := s.pool.Query(ctx, `SELECT subject_id, task_id, value, computed FROM scores`)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (Score, error) {
		var v Score
		return v, r.Scan(&v.SubjectID, &v.TaskID, &v.Value, &v.Computed)
	})
}

func (s *Store) SetScore(ctx context.Context, sc Score) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO scores (subject_id, task_id, value, computed) VALUES ($1, $2, $3, $4)
		ON CONFLICT (subject_id, task_id)
		DO UPDATE SET value = EXCLUDED.value, computed = EXCLUDED.computed`,
		sc.SubjectID, sc.TaskID, sc.Value, sc.Computed)
	return wrap(err)
}

func (s *Store) DeleteScore(ctx context.Context, subjectID, taskID int) error {
	return s.exec(ctx, `DELETE FROM scores WHERE subject_id = $1 AND task_id = $2`, subjectID, taskID)
}

func (s *Store) exec(ctx context.Context, sql string, args ...any) error {
	tag, err := s.pool.Exec(ctx, sql, args...)
	if err != nil {
		return wrap(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func collect[T any](rows pgx.Rows, scan func(pgx.Rows) (T, error)) ([]T, error) {
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func wrap(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return ErrConflict
		case "23503":
			return ErrInvalidRef
		}
	}
	return err
}
