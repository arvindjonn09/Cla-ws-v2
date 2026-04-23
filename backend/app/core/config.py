from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Financial Command Center"
    ENVIRONMENT: str = "development"
    DEBUG: bool = Field(default=True, validation_alias="APP_DEBUG")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://fcc_user:password@localhost:5432/financial_command_center"
    DATABASE_URL_SYNC: str = Field(
        default="postgresql://fcc_user:password@localhost:5432/financial_command_center",
        validation_alias=AliasChoices("DATABASE_URL_SYNC", "SYNC_DATABASE_URL"),
    )

    # Security
    SECRET_KEY: str = "change-this-to-a-very-long-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 15

    # Zoho SMTP
    ZOHO_SMTP_HOST: str = Field(default="smtp.zoho.com", validation_alias=AliasChoices("ZOHO_SMTP_HOST", "SMTP_HOST"))
    ZOHO_SMTP_PORT: int = Field(default=587, validation_alias=AliasChoices("ZOHO_SMTP_PORT", "SMTP_PORT"))
    ZOHO_SMTP_USER: str = Field(
        default="noreply@yourdomain.com",
        validation_alias=AliasChoices("ZOHO_SMTP_USER", "SMTP_USER"),
    )
    ZOHO_SMTP_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices("ZOHO_SMTP_PASSWORD", "SMTP_PASSWORD", "SMTP_PASS"),
    )
    ZOHO_FROM_NAME: str = Field(
        default="Financial Command Center",
        validation_alias=AliasChoices("ZOHO_FROM_NAME", "EMAIL_FROM_NAME", "SMTP_FROM_NAME"),
    )

    # Exchange Rates
    EXCHANGE_RATE_API_URL: str = "https://api.frankfurter.app"
    EXCHANGE_RATE_FETCH_HOUR_IST: int = 9
    EXCHANGE_RATE_FETCH_MINUTE_IST: int = 0

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Admin
    ADMIN_EMAIL: str = "admin@yourdomain.com"
    ADMIN_PHONE: str = "+1234567890"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
