package main

import (
	"context"
	"log"
	"os"

	"afro/internal/api"
	"afro/internal/store"
)

func main() {
	ctx := context.Background()

	st, err := store.Open(ctx, env("DATABASE_URL", "postgres://afro:afro@db:5432/afro?sslmode=disable"))
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer st.Close()

	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	app := api.New(st, env("ADMIN_PASSWORD", "admin"))
	log.Fatal(app.Listen(":" + env("PORT", "8080")))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
