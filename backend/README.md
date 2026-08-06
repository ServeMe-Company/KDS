# ServeME Backend Service

FastAPI backend with SQLite / MySQL database support, real-time WebSocket / Socket.IO updates, and CRUD endpoints for restaurants, menu items, categories, and orders.

## Setup & Running

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Seed Initial Menu Data**:
   ```bash
   python seed_menu.py
   ```

3. **Run Dev Server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
