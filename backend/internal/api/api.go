package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"

	"afro/internal/store"

	"github.com/gofiber/fiber/v2"
)

type server struct {
	st    *store.Store
	token string
}

func New(st *store.Store, adminPassword string) *fiber.App {
	sum := sha256.Sum256([]byte("afro:" + adminPassword))
	s := &server{st: st, token: hex.EncodeToString(sum[:])}

	app := fiber.New(fiber.Config{ErrorHandler: errorHandler})

	api := app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"ok": true}) })
	api.Post("/login", s.login)
	api.Get("/session", s.session)

	api.Get("/subjects", s.listSubjects)
	api.Get("/tasks", s.listTasks)
	api.Get("/tasksets", s.listTaskSets)
	api.Get("/scores", s.listScores)

	admin := api.Group("", s.requireAdmin)
	admin.Post("/subjects", s.createSubject)
	admin.Patch("/subjects/:id", s.updateSubject)
	admin.Put("/subjects/order", s.reorderSubjects)
	admin.Put("/subjects/:id/archived", s.archiveSubject)
	admin.Put("/subjects/:id/set", s.moveSubject)
	admin.Post("/tasksets", s.createTaskSet)
	admin.Patch("/tasksets/:id", s.updateTaskSet)
	admin.Put("/tasksets/:id/default", s.setDefaultTaskSet)
	admin.Post("/tasks", s.createTask)
	admin.Put("/tasks/order", s.reorderTasks)
	admin.Patch("/tasks/:id", s.updateTask)
	admin.Put("/tasks/:id/archived", s.archiveTask)
	admin.Put("/scores", s.setScore)
	admin.Delete("/scores/:subjectId/:taskId", s.deleteScore)

	return app
}

func (s *server) login(c *fiber.Ctx) error {
	var body struct{ Password string `json:"password"` }
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	sum := sha256.Sum256([]byte("afro:" + body.Password))
	if subtle.ConstantTimeCompare([]byte(hex.EncodeToString(sum[:])), []byte(s.token)) != 1 {
		return fiber.NewError(fiber.StatusUnauthorized, "wrong password")
	}
	return c.JSON(fiber.Map{"token": s.token})
}

func (s *server) session(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"admin": s.isAdmin(c)})
}

func (s *server) isAdmin(c *fiber.Ctx) bool {
	return subtle.ConstantTimeCompare([]byte(s.bearer(c)), []byte(s.token)) == 1
}

func (s *server) requireAdmin(c *fiber.Ctx) error {
	if !s.isAdmin(c) {
		return fiber.NewError(fiber.StatusUnauthorized, "login required")
	}
	return c.Next()
}

func (s *server) bearer(c *fiber.Ctx) string {
	return strings.TrimPrefix(c.Get("Authorization"), "Bearer ")
}

func (s *server) listSubjects(c *fiber.Ctx) error {
	v, err := s.st.Subjects(c.Context(), s.isAdmin(c))
	return respond(c, v, err)
}

func (s *server) createSubject(c *fiber.Ctx) error {
	body, err := parseSubject(c)
	if err != nil {
		return err
	}
	v, err := s.st.CreateSubject(c.Context(), body.Name, body.Note, body.Reference, body.Size, body.SetID)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(v)
}

func (s *server) updateSubject(c *fiber.Ctx) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	body, err := parseSubject(c)
	if err != nil {
		return err
	}
	v, err := s.st.UpdateSubject(c.Context(), id, body.Name, body.Note, body.Reference, body.Size)
	return respond(c, v, err)
}

func (s *server) moveSubject(c *fiber.Ctx) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	var body struct {
		SetID *int `json:"set_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	v, err := s.st.MoveSubject(c.Context(), id, body.SetID)
	return respond(c, v, err)
}

func (s *server) setDefaultTaskSet(c *fiber.Ctx) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	if err := s.st.SetDefaultTaskSet(c.Context(), id); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (s *server) archiveSubject(c *fiber.Ctx) error {
	id, archived, err := parseArchived(c)
	if err != nil {
		return err
	}
	v, err := s.st.ArchiveSubject(c.Context(), id, archived)
	return respond(c, v, err)
}

func (s *server) listTasks(c *fiber.Ctx) error {
	v, err := s.st.Tasks(c.Context(), s.isAdmin(c))
	return respond(c, v, err)
}

func (s *server) createTask(c *fiber.Ctx) error {
	var body struct {
		Name  string `json:"name"`
		SetID int    `json:"set_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	if body.SetID == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "set_id is required")
	}
	v, err := s.st.CreateTask(c.Context(), body.SetID, name)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(v)
}

func (s *server) listTaskSets(c *fiber.Ctx) error {
	v, err := s.st.TaskSets(c.Context())
	return respond(c, v, err)
}

func (s *server) createTaskSet(c *fiber.Ctx) error {
	name, err := parseTask(c)
	if err != nil {
		return err
	}
	v, err := s.st.CreateTaskSet(c.Context(), name)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(v)
}

func (s *server) updateTaskSet(c *fiber.Ctx) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	name, err := parseTask(c)
	if err != nil {
		return err
	}
	v, err := s.st.UpdateTaskSet(c.Context(), id, name)
	return respond(c, v, err)
}

func (s *server) updateTask(c *fiber.Ctx) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	name, err := parseTask(c)
	if err != nil {
		return err
	}
	v, err := s.st.UpdateTask(c.Context(), id, name)
	return respond(c, v, err)
}

func (s *server) archiveTask(c *fiber.Ctx) error {
	id, archived, err := parseArchived(c)
	if err != nil {
		return err
	}
	v, err := s.st.ArchiveTask(c.Context(), id, archived)
	return respond(c, v, err)
}

func (s *server) listScores(c *fiber.Ctx) error {
	v, err := s.st.Scores(c.Context())
	return respond(c, v, err)
}

func (s *server) setScore(c *fiber.Ctx) error {
	var body store.Score
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if body.Value != nil {
		if *body.Value < 0 || *body.Value > 100 {
			return fiber.NewError(fiber.StatusBadRequest, "value must be 0-100")
		}
		body.Computed = true
	}
	// Neither a number nor the computed mark means there is nothing left to track.
	if body.Value == nil && !body.Computed {
		if err := s.st.DeleteScore(c.Context(), body.SubjectID, body.TaskID); err != nil && !errors.Is(err, store.ErrNotFound) {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
	if err := s.st.SetScore(c.Context(), body); err != nil {
		return err
	}
	return c.JSON(body)
}

func (s *server) deleteScore(c *fiber.Ctx) error {
	subjectID, err := param(c, "subjectId")
	if err != nil {
		return err
	}
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	if err := s.st.DeleteScore(c.Context(), subjectID, taskID); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

type subjectBody struct {
	Name      string   `json:"name"`
	Note      string   `json:"note"`
	Reference bool     `json:"reference"`
	Size      *float64 `json:"size"`
	SetID     *int     `json:"set_id"`
}

func (s *server) reorderSubjects(c *fiber.Ctx) error {
	ids, err := parseOrder(c)
	if err != nil {
		return err
	}
	if err := s.st.ReorderSubjects(c.Context(), ids); err != nil {
		return err
	}
	return s.listSubjects(c)
}

func (s *server) reorderTasks(c *fiber.Ctx) error {
	ids, err := parseOrder(c)
	if err != nil {
		return err
	}
	if err := s.st.ReorderTasks(c.Context(), ids); err != nil {
		return err
	}
	return s.listTasks(c)
}

func parseOrder(c *fiber.Ctx) ([]int, error) {
	var body struct {
		IDs []int `json:"ids"`
	}
	if err := c.BodyParser(&body); err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if len(body.IDs) == 0 {
		return nil, fiber.NewError(fiber.StatusBadRequest, "ids are required")
	}
	return body.IDs, nil
}

func parseSubject(c *fiber.Ctx) (subjectBody, error) {
	var body subjectBody
	if err := c.BodyParser(&body); err != nil {
		return body, fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Note = strings.TrimSpace(body.Note)
	if body.Name == "" {
		return body, fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	if body.Size != nil && *body.Size <= 0 {
		return body, fiber.NewError(fiber.StatusBadRequest, "size must be greater than 0")
	}
	return body, nil
}

func parseArchived(c *fiber.Ctx) (int, bool, error) {
	id, err := param(c, "id")
	if err != nil {
		return 0, false, err
	}
	var body struct {
		Archived bool `json:"archived"`
	}
	if err := c.BodyParser(&body); err != nil {
		return 0, false, fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	return id, body.Archived, nil
}

func parseTask(c *fiber.Ctx) (string, error) {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return "", fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return "", fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	return name, nil
}

func param(c *fiber.Ctx, key string) (int, error) {
	id, err := strconv.Atoi(c.Params(key))
	if err != nil {
		return 0, fiber.NewError(fiber.StatusBadRequest, "invalid "+key)
	}
	return id, nil
}

func respond[T any](c *fiber.Ctx, v T, err error) error {
	if err != nil {
		return err
	}
	return c.JSON(v)
}

func errorHandler(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		err = fiber.NewError(fiber.StatusNotFound, "not found")
	case errors.Is(err, store.ErrConflict):
		err = fiber.NewError(fiber.StatusConflict, "name already exists")
	case errors.Is(err, store.ErrInvalidRef):
		err = fiber.NewError(fiber.StatusBadRequest, "unknown subject or task")
	}
	var fe *fiber.Error
	if !errors.As(err, &fe) {
		fe = fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
}
