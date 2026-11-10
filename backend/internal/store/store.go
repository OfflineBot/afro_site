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
	Size *float64 `json:"size"`
}

type Task struct {
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
			size      double precision CHECK (size > 0)
		);
		CREATE TABLE IF NOT EXISTS tasks (
			id       serial PRIMARY KEY,
			name     text NOT NULL UNIQUE,
			position integer NOT NULL DEFAULT 0
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
		ALTER TABLE scores ALTER COLUMN value DROP NOT NULL;
		ALTER TABLE scores ADD COLUMN IF NOT EXISTS computed boolean NOT NULL DEFAULT false;

		-- Reordering always writes 1..n, so position 0 marks a row that never got one.
		UPDATE subjects SET position = id WHERE position = 0;
		UPDATE tasks SET position = id WHERE position = 0;
		UPDATE scores SET computed = true WHERE value IS NOT NULL AND NOT computed;
	`)
	return err
}

func (s *Store) Subjects(ctx context.Context) ([]Subject, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, note, position, reference, size FROM subjects ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (Subject, error) {
		var v Subject
		return v, r.Scan(&v.ID, &v.Name, &v.Note, &v.Position, &v.Reference, &v.Size)
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

func (s *Store) DeleteSubject(ctx context.Context, id int) error {
	return s.exec(ctx, `DELETE FROM subjects WHERE id = $1`, id)
}

func (s *Store) Tasks(ctx context.Context) ([]Task, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, position FROM tasks ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Rows) (Task, error) {
		var v Task
		return v, r.Scan(&v.ID, &v.Name, &v.Position)
	})
}

func (s *Store) CreateTask(ctx context.Context, name string) (Task, error) {
	v := Task{Name: name}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO tasks (name, position)
		 VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks))
		 RETURNING id, position`, name).Scan(&v.ID, &v.Position)
	return v, wrap(err)
}

func (s *Store) UpdateTask(ctx context.Context, id int, name string) (Task, error) {
	v := Task{ID: id}
	err := s.pool.QueryRow(ctx,
		`UPDATE tasks SET name = $2 WHERE id = $1 RETURNING name, position`,
		id, name).Scan(&v.Name, &v.Position)
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

func (s *Store) DeleteTask(ctx context.Context, id int) error {
	return s.exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
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
