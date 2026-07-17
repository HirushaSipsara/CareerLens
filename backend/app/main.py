from fastapi import FastAPI

app = FastAPI(title="CareerLens API")


@app.get("/")
def read_root():
    return {"message": "Welcome to CareerLens API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
