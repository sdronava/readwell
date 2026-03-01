from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    local_mode: bool = True
    books_dir: str = "./books"
    content_base_url: str = "http://localhost:9000"


settings = Settings()
