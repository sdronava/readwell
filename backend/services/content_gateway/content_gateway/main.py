from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from content_gateway.routers import books, health

app = FastAPI(title="Readwell Content Gateway", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(books.router)
