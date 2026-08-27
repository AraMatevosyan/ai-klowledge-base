-- CreateTable
CREATE TABLE "ai_daily_usage" (
    "user_id" TEXT NOT NULL,
    "usage_date" DATE NOT NULL,
    "spent_nano_usd" BIGINT NOT NULL DEFAULT 0,
    "reserved_nano_usd" BIGINT NOT NULL DEFAULT 0,
    "chat_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "chat_cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "chat_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "embedding_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_daily_usage_pkey" PRIMARY KEY ("user_id","usage_date")
);

-- CreateIndex
CREATE INDEX "ai_daily_usage_usage_date_idx" ON "ai_daily_usage"("usage_date");

-- AddForeignKey
ALTER TABLE "ai_daily_usage" ADD CONSTRAINT "ai_daily_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
