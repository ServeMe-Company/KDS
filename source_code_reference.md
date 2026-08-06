# 📦 ServeME Complete Source Code Reference

This document contains the complete, up-to-date source code for all components in the **ServeME** repository.

---

## 📄 backend/database.py

`python
# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Update 'root' and 'password' to match your local MySQL credentials
MYSQL_URL = "mysql+pymysql://root:password@localhost:3306/serveme_db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", MYSQL_URL)

try:
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        # Test connection quickly
        with engine.connect() as conn:
            pass
except Exception as e:
    print(f"Warning: Failed to connect to MySQL ({SQLALCHEMY_DATABASE_URL}): {e}")
    print("Falling back to SQLite (sqlite:///./serveme.db) for local development.")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./serveme.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# Create a session local class for database interactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency function to get the database session in our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

`

---

## 📄 backend/models.py

`python
# backend/models.py
from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, Text, Float, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    # Relationships
    categories = relationship("Category", back_populates="restaurant", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    restaurant = relationship("Restaurant", back_populates="categories")
    menu_items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    price = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_veg = Column(Boolean, default=True)
    is_spicy = Column(Boolean, default=False)
    tags = Column(String(255), nullable=True) # e.g., "Special, Bestseller"
    stock = Column(Integer, default=0, nullable=False)
    recipe_instructions = Column(Text, nullable=True)  # Kitchen prep instructions
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    category = relationship("Category", back_populates="menu_items")


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    COOKING = "cooking"
    READY = "ready"
    COMPLETED = "completed"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    order_number = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(
        Enum(OrderStatus, values_callable=lambda statuses: [status.value for status in statuses]),
        nullable=False,
        default=OrderStatus.PENDING,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    restaurant = relationship("Restaurant")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price_at_time_of_order = Column(Float, nullable=False)
    notes = Column(String(500), nullable=True)  # Per-item kitchen instructions

    # Relationships
    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")

`

---

## 📄 backend/schemas.py

`python
# backend/schemas.py
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

# --- Menu Items ---
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_veg: Optional[bool] = True
    is_spicy: Optional[bool] = False
    tags: Optional[str] = None
    is_active: Optional[bool] = True
    recipe_instructions: Optional[str] = None
    stock: Optional[int] = 0

class MenuItemCreate(MenuItemBase):
    pass

class MenuItemResponse(MenuItemBase):
    id: int
    is_available: bool
    is_active: bool

    class Config:
        from_attributes = True

class MenuItemVisibilityUpdate(BaseModel):
    is_active: bool

# --- Categories ---
class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    menu_items: List[MenuItemResponse] = []

    class Config:
        from_attributes = True

# --- Restaurants ---
class RestaurantBase(BaseModel):
    name: str

class RestaurantCreate(RestaurantBase):
    pass

class RestaurantResponse(RestaurantBase):
    id: int
    categories: List[CategoryResponse] = []

    class Config:
        from_attributes = True


# --- Orders & Checkout ---
class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int
    notes: Optional[str] = None  # Per-item kitchen instructions

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]

class OrderItemResponse(BaseModel):
    id: int
    menu_item_id: int
    quantity: int
    price_at_time_of_order: float
    menu_item_name: str = ""
    notes: Optional[str] = None
    recipe_instructions: Optional[str] = None

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    restaurant_id: int
    order_number: int
    total_amount: float
    status: str
    created_at: Optional[datetime] = None
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: str


# --- Product Catalog (Sync endpoints) ---
class ProductCreate(BaseModel):
    product_name: str
    price: float
    status: str
    image_url: Optional[str] = None
    is_veg: Optional[bool] = True
    is_spicy: Optional[bool] = False
    stock: int = 0
    category: Optional[str] = None

class ProductUpdate(BaseModel):
    product_name: str
    price: float
    status: str
    image_url: Optional[str] = None
    is_veg: Optional[bool] = True
    is_spicy: Optional[bool] = False
    stock: int = 0
    category: Optional[str] = None

class ProductStatusUpdate(BaseModel):
    id: int
    status: str


`

---

## 📄 backend/main.py

`python
# backend/main.py
import io
import os
import uuid
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session, joinedload
import qrcode
import socketio
import cloudinary
import cloudinary.uploader
from database import engine, get_db
import models
import schemas

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Create tables
models.Base.metadata.create_all(bind=engine)


def ensure_order_kitchen_columns():
    inspector = inspect(engine)
    if not inspector.has_table("orders"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("orders")}
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if "status" not in existing_columns:
            if dialect == "mysql":
                conn.execute(text("ALTER TABLE orders ADD COLUMN status VARCHAR(9) NOT NULL DEFAULT 'pending'"))
            else:
                conn.execute(text("ALTER TABLE orders ADD COLUMN status VARCHAR(9) NOT NULL DEFAULT 'pending'"))

        if "created_at" not in existing_columns:
            if dialect == "mysql":
                conn.execute(text("ALTER TABLE orders ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"))
            else:
                conn.execute(text("ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))


def ensure_menu_item_columns():
    inspector = inspect(engine)
    if not inspector.has_table("menu_items"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("menu_items")}
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if "is_active" not in existing_columns:
            if dialect == "mysql":
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1"))
            else:
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))

        if "stock" not in existing_columns:
            if dialect == "mysql":
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN stock INT NOT NULL DEFAULT 0"))
            else:
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN stock INTEGER NOT NULL DEFAULT 0"))


ensure_order_kitchen_columns()
ensure_menu_item_columns()

def ensure_new_kitchen_columns():
    """Safely add recipe_instructions to menu_items and notes to order_items."""
    inspector = inspect(engine)
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if inspector.has_table("menu_items"):
            existing = {c["name"] for c in inspector.get_columns("menu_items")}
            if "recipe_instructions" not in existing:
                conn.execute(text("ALTER TABLE menu_items ADD COLUMN recipe_instructions TEXT"))

        if inspector.has_table("order_items"):
            existing = {c["name"] for c in inspector.get_columns("order_items")}
            if "notes" not in existing:
                if dialect == "mysql":
                    conn.execute(text("ALTER TABLE order_items ADD COLUMN notes VARCHAR(500)"))
                else:
                    conn.execute(text("ALTER TABLE order_items ADD COLUMN notes VARCHAR(500)"))

ensure_new_kitchen_columns()

app = FastAPI(title="ServeMe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

@sio.event
async def connect(sid, environ):
    print(f"Socket.io client connected: {sid}", flush=True)

@sio.event
async def disconnect(sid):
    print(f"Socket.io client disconnected: {sid}", flush=True)

@sio.on('join_restaurant')
async def join_restaurant(sid, data):
    restaurant_id = data.get("restaurant_id")
    if restaurant_id:
        await sio.enter_room(sid, f"restaurant_{restaurant_id}")
        print(f"Socket.io client {sid} joined room restaurant_{restaurant_id}", flush=True)






# 1. Create a Restaurant
@app.post("/restaurants/", response_model=schemas.RestaurantResponse)
def create_restaurant(restaurant: schemas.RestaurantCreate, db: Session = Depends(get_db)):
    db_restaurant = models.Restaurant(name=restaurant.name)
    db.add(db_restaurant)
    db.commit()
    db.refresh(db_restaurant)
    return db_restaurant

# 2. Get a Restaurant and its Full Menu (accepts admin query parameter to return all or only active items)
@app.get("/restaurants/{restaurant_id}", response_model=schemas.RestaurantResponse)
def get_restaurant_menu(restaurant_id: int, admin: bool = False, db: Session = Depends(get_db)):
    db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if db_restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    if admin:
        return db_restaurant

    # Filter out inactive/unapplied menu items for customer menu
    filtered_categories = []
    for category in db_restaurant.categories:
        active_items = [item for item in category.menu_items if item.is_active and item.is_available]
        filtered_categories.append({
            "id": category.id,
            "name": category.name,
            "menu_items": active_items
        })

    return {
        "id": db_restaurant.id,
        "name": db_restaurant.name,
        "categories": filtered_categories
    }


# 3. Create a Category for a Restaurant
@app.post("/restaurants/{restaurant_id}/categories/", response_model=schemas.CategoryResponse)
def create_category(restaurant_id: int, category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    # Verify restaurant exists
    db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    db_category = models.Category(**category.dict(), restaurant_id=restaurant_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


# 4. Add a Menu Item to a Category
@app.post("/categories/{category_id}/items/", response_model=schemas.MenuItemResponse)
def create_menu_item(category_id: int, item: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    # Verify category exists
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    db_item = models.MenuItem(**item.dict(), category_id=category_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


# 5. Place an Order (Checkout)
@app.post("/restaurants/{restaurant_id}/orders/", response_model=schemas.OrderResponse)
async def place_order(restaurant_id: int, order_req: schemas.OrderCreate, db: Session = Depends(get_db)):
    # 1. Verify the restaurant exists
    db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # 2. Generate the unique Order Number for this restaurant
    # This finds the current highest order number and adds 1. If it's the first order, it starts at 1.
    max_order = db.query(func.max(models.Order.order_number)).filter(models.Order.restaurant_id == restaurant_id).scalar()
    next_order_number = (max_order or 0) + 1

    # 3. Calculate Total Amount securely & lock in the prices
    total_amount = 0.0
    order_items = []

    for item_req in order_req.items:
        # Fetch the item from the database to get the CURRENT price securely
        menu_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_req.menu_item_id).first()
        
        if not menu_item or not menu_item.is_available or not menu_item.is_active:
            raise HTTPException(status_code=400, detail=f"Item ID {item_req.menu_item_id} is unavailable")

        # Calculate math on the backend so customers can't hack the price
        item_total = menu_item.price * item_req.quantity
        total_amount += item_total

        # Prepare the item for the database, locking in the price
        order_items.append(
            models.OrderItem(
                menu_item_id=menu_item.id,
                quantity=item_req.quantity,
                price_at_time_of_order=menu_item.price,
                notes=item_req.notes
            )
        )

    # 4. Create the main Order row
    db_order = models.Order(
        restaurant_id=restaurant_id,
        order_number=next_order_number,
        total_amount=total_amount
    )
    db.add(db_order)
    db.flush() # This assigns an ID to db_order without finalizing the save yet

    # 5. Attach all the individual items to this Order
    for o_item in order_items:
        o_item.order_id = db_order.id
        db.add(o_item)

    # 6. Save everything to the database
    db.commit()
    db.refresh(db_order)

    # Enrich response with product names, notes, and recipe instructions
    for item in db_order.items:
        item.menu_item_name = item.menu_item.name if item.menu_item else f"Item #{item.menu_item_id}"
        item.recipe_instructions = item.menu_item.recipe_instructions if item.menu_item else None

    await sio.emit("order_update", "UPDATE_ORDERS", room=f"restaurant_{restaurant_id}")
    
    return db_order


# 6. KITCHEN: Get all active orders (Hide completed ones)
@app.get("/restaurants/{restaurant_id}/orders/", response_model=List[schemas.OrderResponse])
def get_active_orders(restaurant_id: int, db: Session = Depends(get_db)):
    db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    orders = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.menu_item)
    ).filter(
        models.Order.restaurant_id == restaurant_id,
        models.Order.status != models.OrderStatus.COMPLETED
    ).order_by(models.Order.created_at.asc()).all()

    # Enrich each order item with the product name, notes, and recipe instructions
    for order in orders:
        for item in order.items:
            item.menu_item_name = item.menu_item.name if item.menu_item else f"Item #{item.menu_item_id}"
            item.recipe_instructions = item.menu_item.recipe_instructions if item.menu_item else None

    return orders


# 7. KITCHEN: Update Order Status
@app.patch("/orders/{order_id}/status", response_model=schemas.OrderResponse)
async def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    valid_statuses = {status.value for status in models.OrderStatus}
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid order status")

    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    db_order.status = status_update.status
    db.commit()
    db.refresh(db_order)

    await sio.emit("order_update", "UPDATE_ORDERS", room=f"restaurant_{db_order.restaurant_id}")
    return db_order


# 8. ADMIN: Generate a printable QR Code for the restaurant
@app.get("/restaurants/{restaurant_id}/qrcode")
def generate_restaurant_qrcode(restaurant_id: int, db: Session = Depends(get_db)):
    db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    qr_url = f"http://localhost:5173/?restaurant_id={restaurant_id}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    img_buffer = io.BytesIO()
    img.save(img_buffer, "PNG")
    img_buffer.seek(0)

    return StreamingResponse(
        img_buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=restaurant_{restaurant_id}_qr.png"},
    )


# 9. ADMIN: Toggle Menu Item Visibility
@app.patch("/menu-items/{item_id}/visibility", response_model=schemas.MenuItemResponse)
async def update_item_visibility(item_id: int, visibility_update: schemas.MenuItemVisibilityUpdate, db: Session = Depends(get_db)):
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
        
    db_item.is_active = visibility_update.is_active
    db.commit()
    db.refresh(db_item)
    
    # Broadcast to all clients in the restaurant room
    restaurant_id = db_item.category.restaurant_id
    await sio.emit("menu_update", "UPDATE_MENU", room=f"restaurant_{restaurant_id}")
    
    return db_item



# --- PRODUCT CATALOG INTEGRATION ENDPOINTS ---

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    result = cloudinary.uploader.upload(file.file)
    return {"url": result.get("secure_url")}


@app.get("/api/vendor/stats")
def get_vendor_stats(restaurant_id: int = 1, db: Session = Depends(get_db)):
    total_products = db.query(models.MenuItem).join(models.Category).filter(models.Category.restaurant_id == restaurant_id).count()
    total_orders = db.query(models.Order).filter(models.Order.restaurant_id == restaurant_id).count()
    total_payments = db.query(func.sum(models.Order.total_amount)).filter(models.Order.restaurant_id == restaurant_id).scalar() or 0.0
    total_customers = db.query(models.Order.id).filter(models.Order.restaurant_id == restaurant_id).distinct().count()
    return {
        "total_orders": total_orders,
        "total_payments": total_payments,
        "total_products": total_products,
        "total_customers": total_customers
    }


@app.get("/api/orders")
def get_orders(restaurant_id: int = 1, db: Session = Depends(get_db)):
    orders = db.query(models.Order).filter(models.Order.restaurant_id == restaurant_id).order_by(models.Order.id.desc()).all()
    result = []
    for order in orders:
        result.append({
            "id": f"ORD-{order.id:03d}",
            "date": order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else "",
            "customer": "Walk-in Customer",
            "mobile": "N/A",
            "amount": order.total_amount
        })
    return result


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, restaurant_id: int = 1, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.restaurant_id == restaurant_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"message": "Order deleted successfully"}


@app.delete("/api/orders")
def delete_all_orders(restaurant_id: int = 1, db: Session = Depends(get_db)):
    db.query(models.Order).filter(models.Order.restaurant_id == restaurant_id).delete()
    db.commit()
    return {"message": "All orders deleted successfully"}


@app.get("/api/products")
def get_products(status: Optional[str] = None, restaurant_id: int = 1, db: Session = Depends(get_db)):
    query = db.query(models.MenuItem).join(models.Category).filter(models.Category.restaurant_id == restaurant_id)
    if status:
        is_active_val = True if status == "active" else False
        query = query.filter(models.MenuItem.is_active == is_active_val)
    
    menu_items = query.all()
    
    products = []
    for item in menu_items:
        products.append({
            "id": item.id,
            "product_name": item.name,
            "sku": item.tags or "",
            "status": "active" if item.is_active else "inactive",
            "price": item.price,
            "category": item.category.name if item.category else None,
            "image_url": item.image_url,
            "is_veg": item.is_veg,
            "is_spicy": item.is_spicy,
            "stock": item.stock,
            "recipe_instructions": item.recipe_instructions
        })
    return products


@app.post("/api/products")
async def create_product(product: schemas.ProductCreate, restaurant_id: int = 1, db: Session = Depends(get_db)):
    sku_val = f"SKU-{uuid.uuid4().hex[:8].upper()}"
    
    cat_name = (product.category or "Others").strip().title()
    category = db.query(models.Category).filter(
        func.lower(models.Category.name) == func.lower(cat_name),
        models.Category.restaurant_id == restaurant_id
    ).first()
    
    if not category:
        # Verify restaurant exists
        db_restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
        if not db_restaurant:
            db_restaurant = models.Restaurant(id=restaurant_id, name="Serve Me")
            db.add(db_restaurant)
            db.commit()
            db.refresh(db_restaurant)
            
        category = models.Category(name=cat_name, restaurant_id=restaurant_id)
        db.add(category)
        db.commit()
        db.refresh(category)
        
    is_active_val = True if product.status == "active" else False
    
    db_item = models.MenuItem(
        name=product.product_name,
        description=f"Delicious {product.product_name}.",
        price=product.price,
        image_url=product.image_url,
        is_active=is_active_val,
        is_available=is_active_val,  # Set available immediately if active so it displays on the menu
        is_veg=product.is_veg,
        is_spicy=product.is_spicy,
        tags=sku_val,
        stock=product.stock,
        category_id=category.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Broadcast Socket.io update to the restaurant
    await sio.emit("menu_update", "UPDATE_MENU", room=f"restaurant_{restaurant_id}")
    
    return {
        "id": db_item.id,
        "product_name": db_item.name,
        "sku": db_item.tags,
        "status": "active" if db_item.is_active else "inactive",
        "price": db_item.price,
        "category": category.name,
        "image_url": db_item.image_url,
        "is_veg": db_item.is_veg,
        "is_spicy": db_item.is_spicy,
        "stock": db_item.stock
    }


@app.put("/api/products/bulk")
async def update_products_bulk(updates: List[schemas.ProductStatusUpdate], restaurant_id: int = 1, db: Session = Depends(get_db)):
    try:
        for update in updates:
            db_item = db.query(models.MenuItem).join(models.Category).filter(
                models.MenuItem.id == update.id,
                models.Category.restaurant_id == restaurant_id
            ).first()
            if db_item:
                is_act = True if update.status == "active" else False
                db_item.is_active = is_act
                db_item.is_available = is_act
        db.commit()
        
        await sio.emit("menu_update", "UPDATE_MENU", room=f"restaurant_{restaurant_id}")
        return {"message": "Updated successfully"}
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/products/{product_id}")
async def update_product(product_id: int, product: schemas.ProductUpdate, restaurant_id: int = 1, db: Session = Depends(get_db)):
    db_item = db.query(models.MenuItem).join(models.Category).filter(
        models.MenuItem.id == product_id,
        models.Category.restaurant_id == restaurant_id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Product not found")
        
    cat_name = (product.category or "Others").strip().title()
    category = db.query(models.Category).filter(
        func.lower(models.Category.name) == func.lower(cat_name),
        models.Category.restaurant_id == restaurant_id
    ).first()
    
    if not category:
        category = models.Category(name=cat_name, restaurant_id=restaurant_id)
        db.add(category)
        db.commit()
        db.refresh(category)
        
    is_active_val = True if product.status == "active" else False
    
    db_item.name = product.product_name
    db_item.price = product.price
    db_item.is_active = is_active_val
    db_item.is_available = is_active_val  # Set available immediately if active so it displays on the menu
    if product.image_url is not None:
        db_item.image_url = product.image_url
    db_item.is_veg = product.is_veg
    db_item.is_spicy = product.is_spicy
    db_item.stock = product.stock
    db_item.category_id = category.id
    
    db.commit()
    db.refresh(db_item)
    
    await sio.emit("menu_update", "UPDATE_MENU", room=f"restaurant_{restaurant_id}")
    
    return {
        "id": db_item.id,
        "product_name": db_item.name,
        "sku": db_item.tags,
        "status": "active" if db_item.is_active else "inactive",
        "price": db_item.price,
        "category": category.name,
        "image_url": db_item.image_url,
        "is_veg": db_item.is_veg,
        "is_spicy": db_item.is_spicy,
        "stock": db_item.stock
    }


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, restaurant_id: int = 1, db: Session = Depends(get_db)):
    db_item = db.query(models.MenuItem).join(models.Category).filter(
        models.MenuItem.id == product_id,
        models.Category.restaurant_id == restaurant_id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Product not found")
        
    db.delete(db_item)
    db.commit()
    
    await sio.emit("menu_update", "UPDATE_MENU", room=f"restaurant_{restaurant_id}")
    return {"message": "Product deleted successfully"}


# Wrap the FastAPI app with the Socket.io ASGIApp so that uvicorn runs it directly
app = socketio.ASGIApp(sio, other_asgi_app=app)

`

---

## 📄 backend/seed_menu.py

`python
# seed_menu.py
import requests

BASE_URL = "http://127.0.0.1:8000"

def create_restaurant(name):
    r = requests.post(f"{BASE_URL}/restaurants/", json={"name": name})
    r.raise_for_status()
    return r.json()["id"]

def create_category(restaurant_id, name):
    r = requests.post(f"{BASE_URL}/restaurants/{restaurant_id}/categories/", json={"name": name})
    r.raise_for_status()
    return r.json()["id"]

def create_menu_item(category_id, name, description, price, is_veg=True, is_spicy=False, tags=None, image_url=None):
    payload = {
        "name": name,
        "description": description,
        "price": price,
        "is_veg": is_veg,
        "is_spicy": is_spicy,
        "tags": tags
    }
    if image_url:
        payload["image_url"] = image_url
    r = requests.post(f"{BASE_URL}/categories/{category_id}/items/", json=payload)
    r.raise_for_status()
    return r.json()["id"]

def main():
    # 1. Restaurant
    restaurant_id = create_restaurant("Serve Me")
    print("Created restaurant id", restaurant_id)

    # 2. Categories
    category_names = [
        "Starter", "Soup", "Salad", "Pizza", "Chinese", 
        "Punjabi", "South Indian", "Sizzlers", "Beverages", "Dessert"
    ]
    
    categories = {}
    for cat_name in category_names:
        cat_id = create_category(restaurant_id, cat_name)
        categories[cat_name] = cat_id
        print(f"Created category '{cat_name}' id", cat_id)

    # 3. Items for "Starter"
    starter_items = [
        {"name": "French Fries", "price": 400.0, "tags": "Special", "image_url": "/images/french_fries.png"},
        {"name": "Peri Peri French Fries", "price": 180.0, "image_url": "/images/french_fries.png"},
        {"name": "Cheese French Fries", "price": 160.0, "image_url": "/images/french_fries.png"},
        {"name": "Fully Loaded French Fries", "price": 170.0, "image_url": "/images/french_fries.png"},
        {"name": "Cheese Ball", "price": 209.0, "image_url": "/images/pakoda.png"},
        {"name": "Chilli Paneer", "price": 450.0, "tags": "Special", "image_url": "/images/pakoda.png"},
        {"name": "Dragon Potato", "price": 280.0, "is_spicy": True, "image_url": "/images/french_fries.png"},
        {"name": "Onion Pakoda", "price": 110.0, "image_url": "/images/pakoda.png"},
        {"name": "Chana Dal Chat", "price": 70.0, "image_url": "/images/pakoda.png"},
        {"name": "Plain Maggie", "price": 200.0, "tags": "Special", "image_url": "/images/maggi.png"},
        {"name": "Cheese Maggie", "price": 120.0, "tags": "Customizable", "image_url": "/images/maggi.png"},
        {"name": "Vegetable Maggi", "price": 100.0, "tags": "Bestseller", "image_url": "/images/maggi.png"},
        {"name": "Chilli Potato", "price": 240.0, "tags": "Customizable, Bestseller", "image_url": "/images/french_fries.png"},
    ]

    starter_cat_id = categories["Starter"]
    for item in starter_items:
        item_id = create_menu_item(
            category_id=starter_cat_id,
            name=item["name"],
            description=None,
            price=item["price"],
            is_veg=True, # all items in the image are veg
            is_spicy=item.get("is_spicy", False),
            tags=item.get("tags"),
            image_url=item.get("image_url")
        )
        print(f"  Added menu item '{item['name']}' id", item_id)

if __name__ == "__main__":
    main()

`

---

## 📄 frontend/src/config.js

`javascript
const getBackendUrls = () => {
  const hostname = window.location.hostname;
  
  // Check if we are running locally
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');
  
  // Check for environment variables set during build
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    const secure = envApiUrl.startsWith('https');
    const wsProto = secure ? 'wss' : 'ws';
    const cleanHost = envApiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
      api: envApiUrl,
      ws: import.meta.env.VITE_WS_URL || `${wsProto}://${cleanHost}`
    };
  }

  // If local dev but no env variable is set
  if (isLocal) {
    return {
      api: `http://${hostname}:8000`,
      ws: `ws://${hostname}:8000`
    };
  }

  // Deployed in production but no environment variable configured
  return {
    api: '',
    ws: '',
    isMissingConfig: true
  };
};

const urls = getBackendUrls();

export const API_URL = urls.api;
export const WS_URL = urls.ws;
export const IS_MISSING_CONFIG = urls.isMissingConfig;

`

---

## 📄 frontend/src/main.jsx

`javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Kitchen from './Kitchen.jsx'

// Simple client-side routing check
const isKitchen = window.location.pathname === '/kitchen' || new URLSearchParams(window.location.search).get('view') === 'kitchen';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKitchen ? <Kitchen /> : <App />}
  </StrictMode>,
)

`

---

## 📄 frontend/src/App.jsx

`javascript
import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { API_URL, IS_MISSING_CONFIG } from './config';
import { io } from 'socket.io-client';

function App() {
  if (IS_MISSING_CONFIG) {
    return (
      <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Backend Connection Required</h2>
        <p style={{ margin: '15px 0' }}>The application is deployed, but the backend API URL has not been configured.</p>
        <p style={{ fontSize: '14px', color: '#888' }}>
          Please add the <code>VITE_API_URL</code> environment variable in your site configuration settings pointing to your backend URL (e.g. <code>https://your-backend-url.com</code>).
        </p>
      </div>
    );
  }

  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({});
  const [orderNumber, setOrderNumber] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const RESTAURANT_ID = Number(params.get('restaurant_id')) || 1;

  // Filter categories to only those containing items matching the search query
  const filteredCategories = useMemo(() => {
    if (!restaurant) return [];
    return restaurant.categories.map((category) => ({
      ...category,
      menu_items: category.menu_items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter((category) => category.menu_items.length > 0);
  }, [restaurant, searchQuery]);

  const fetchMenu = useCallback(() => {
    fetch(`${API_URL}/restaurants/${RESTAURANT_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Restaurant ${RESTAURANT_ID} was not found`);
        return res.json();
      })
      .then((data) => {
        setError('');
        if (data.categories) {
          data.categories = data.categories.map(category => ({
            ...category,
            menu_items: category.menu_items.map(item => ({
              ...item,
              category_name: category.name
            }))
          }));
        }
        setRestaurant(data);
        if (data.categories && data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load menu", err);
        setRestaurant(null);
        setError(err.message);
      });
  }, [RESTAURANT_ID]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    const socket = io(API_URL, {
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.io backend');
      socket.emit('join_restaurant', { restaurant_id: RESTAURANT_ID });
    });

    socket.on('menu_update', (data) => {
      if (data === 'UPDATE_MENU') {
        console.log('Real-time menu update received. Refreshing menu.');
        fetchMenu();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [RESTAURANT_ID, fetchMenu]);

  // Keep active category pill in view inside scrollable nav bar
  useEffect(() => {
    const activePill = document.querySelector('.category-pill.active');
    if (activePill) {
      activePill.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeCategory]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    
    if (val.trim() && restaurant) {
      // Find categories that have matching items for this new search query
      const matchingCats = restaurant.categories.filter((category) =>
        category.menu_items.some((item) =>
          item.name.toLowerCase().includes(val.toLowerCase())
        )
      );
      
      if (matchingCats.length > 0) {
        // If current activeCategory is NOT in the matching categories, switch to the first matching category
        const isCurrentActiveMatching = matchingCats.some(cat => cat.id === activeCategory);
        if (!isCurrentActiveMatching) {
          setActiveCategory(matchingCats[0].id);
        }
      }
    }
  };

  const handleCategoryClick = (e, catId) => {
    e.preventDefault();
    setSearchQuery('');
    setActiveCategory(catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.quantity || 0;
      if (item.stock !== undefined && item.stock !== null && currentQty >= item.stock) {
        alert(`Sorry, only ${item.stock} quantity available in stock for "${item.name}".`);
        return prev;
      }
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: currentQty + 1,
        },
      };
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[itemId]) {
        if (newCart[itemId].quantity > 1) {
          newCart[itemId].quantity -= 1;
        } else {
          delete newCart[itemId];
        }
      }
      // Auto close cart drawer if empty
      const remainingItems = Object.values(newCart).reduce((sum, item) => sum + item.quantity, 0);
      if (remainingItems === 0) {
        setIsCartOpen(false);
      }
      return newCart;
    });
  };

  const updateCartItemNotes = (itemId, notes) => {
    setCart((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          notes,
        },
      };
    });
  };

  const toggleQuickNote = (itemId, noteText) => {
    setCart((prev) => {
      if (!prev[itemId]) return prev;
      const currentNotes = prev[itemId].notes || '';
      let notesList = currentNotes ? currentNotes.split(',').map(n => n.trim()).filter(Boolean) : [];
      
      if (notesList.includes(noteText)) {
        notesList = notesList.filter(n => n !== noteText);
      } else {
        notesList.push(noteText);
      }
      
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          notes: notesList.join(', '),
        },
      };
    });
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    const orderItems = Object.values(cart).map((item) => ({
      menu_item_id: item.id,
      quantity: item.quantity,
      notes: item.notes || null,
    }));

    try {
      const response = await fetch(`${API_URL}/restaurants/${RESTAURANT_ID}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: orderItems }),
      });
      if (!response.ok) {
        throw new Error("Could not submit order. Please try again.");
      }
      const data = await response.json();
      setOrderNumber(data.order_number);
      setCart({});
      setIsCartOpen(false);
    } catch (error) {
      console.error("Checkout failed", error);
      alert(error.message || "Place order failed. Check server connection.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Calculate Cart Totals
  const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // If order is placed, show the success screen
  if (orderNumber) {
    return (
      <div className="success-screen">
        <div className="success-card" style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '44px 32px',
          borderRadius: '28px',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          maxWidth: '420px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'bounce 2s infinite' }}>🛎️</div>
          <h2>Order Received!</h2>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '12px', fontWeight: 600 }}>Your Token Number</div>
          <h1 className="giant-number" style={{ margin: '8px 0 24px 0' }}>#{orderNumber}</h1>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            👨‍🍳 The kitchen is now preparing your delicious meal!
          </p>
          <div style={{ margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Listen for your token number at the counter.
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              You can pay when picking up your food.
            </p>
          </div>
          <button
            className="checkout-btn"
            style={{ width: '100%', background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 6px 20px rgba(249, 115, 22, 0.3)' }}
            onClick={() => { setOrderNumber(null); }}
          >
            Order More Dishes
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading">
        {error}. Try <strong>?restaurant_id=1</strong> or create this restaurant first.
      </div>
    );
  }

  if (!restaurant) return <div className="loading">Loading Menu...</div>;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div>
          <h1>{restaurant.name}</h1>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '2px', fontWeight: 500 }}>
            ✨ Table Service
          </p>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍  Search delicious dishes..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      <div className="main-content-layout">
        {/* Horizontal/Vertical Categories Menu */}
        <div className="categories-nav">
          {restaurant.categories.map((cat) => (
            <a
              key={cat.id}
              href={`#category-${cat.id}`}
              className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={(e) => handleCategoryClick(e, cat.id)}
            >
              {cat.name}
            </a>
          ))}
        </div>

        {/* Menu Items List */}
        <main className="menu-list">
          {restaurant.categories
            .filter((category) => category.id === activeCategory)
            .map((category) => {
              const matchingItems = category.menu_items.filter((item) =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              return (
                <div key={category.id} className="category-section">
                  <h2 className="category-title">{category.name}</h2>
                  {category.menu_items.length === 0 ? (
                    <div className="empty-category-state" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="#0070c0" style={{ marginBottom: '8px' }}>
                        <rect x="1" y="4" width="13" height="11" rx="1" />
                        <path d="M14 7h4.5a1.5 1.5 0 0 1 1.2.6l2.1 2.8c.2.3.3.6.3 1v3.6h-8.1V7z" />
                        <rect x="15.5" y="8.5" width="4.5" height="3" rx="0.5" fill="#94a3b8" />
                        <circle cx="5" cy="17" r="2.5" fill="#0070c0" />
                        <circle cx="5" cy="17" r="0.9" fill="#ffffff" />
                        <circle cx="17" cy="17" r="2.5" fill="#0070c0" />
                        <circle cx="17" cy="17" r="0.9" fill="#ffffff" />
                      </svg>
                      <p style={{ fontSize: '13px', fontWeight: 600 }}>This category is empty</p>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>No items listed in this category yet</p>
                    </div>
                  ) : matchingItems.length === 0 ? (
                    <div className="empty-category-state" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}>
                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</span>
                      <p style={{ fontSize: '13px', fontWeight: 600 }}>No items matching "{searchQuery}"</p>
                      <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Try searching in another category or clear the query</p>
                    </div>
                  ) : (
                    <div className="menu-items-grid">
                      {matchingItems.map((item) => (
                        <div key={item.id} className="menu-item-card">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="item-thumbnail" />
                          ) : (
                            <div className="item-thumbnail placeholder-thumbnail">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: '#64748b' }}>
                                <path d="M3 18h18" />
                                <path d="M5 18a7 7 0 0 1 14 0H5z" fill="rgba(100, 116, 139, 0.1)" />
                                <circle cx="12" cy="10" r="1" />
                              </svg>
                            </div>
                          )}
                          <div className="item-details">
                            <div className="item-title-row">
                              {item.is_veg !== undefined && (
                                <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`}>
                                  <span className="dot"></span>
                                </span>
                              )}
                              <h3 className="item-name">{item.name}</h3>
                              {item.is_spicy && <span className="spicy-icon" title="Spicy">🌶️</span>}
                            </div>
                            <p className="item-price">₹{item.price}</p>
                            {item.description && <p className="item-desc">{item.description}</p>}
                            
                            {item.stock !== undefined && item.stock !== null && item.stock > 0 && item.stock <= 5 && (
                              <p className="low-stock-warning">⚠️ Only {item.stock} left!</p>
                            )}
                            {item.stock !== undefined && item.stock !== null && item.stock <= 0 && (
                              <p className="out-of-stock-warning">🚫 Out of stock</p>
                            )}

                            {cart[item.id] && !(item.category_name && (item.category_name.toLowerCase() === 'drinks' || item.category_name.toLowerCase() === 'beverages')) && (
                              <div className="instructions-area">
                                <div className="quick-notes-container">
                                  {['🌶️ Spicy', '🚫 No Onion', '🚫 No Garlic', '🧀 More Cheese', '🧂 Less Salt'].map((option) => {
                                    const isSelected = (cart[item.id].notes || '').includes(option);
                                    return (
                                      <button
                                        key={option}
                                        className={`quick-note-chip ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleQuickNote(item.id, option)}
                                      >
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="text"
                                  className="cart-item-notes-input"
                                  placeholder="Or type other instructions..."
                                  value={cart[item.id].notes || ''}
                                  onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="item-action-area">
                            {item.stock !== undefined && item.stock !== null && item.stock <= 0 ? (
                              <button className="add-btn out-of-stock" disabled>
                                Out of Stock
                              </button>
                            ) : cart[item.id] ? (
                              <div className="quantity-control">
                                <button className="qty-btn" onClick={() => removeFromCart(item.id)}>-</button>
                                <span className="qty-text">{cart[item.id].quantity}</span>
                                <button 
                                  className="qty-btn" 
                                  onClick={() => addToCart(item)}
                                  disabled={item.stock !== undefined && item.stock !== null && cart[item.id].quantity >= item.stock}
                                >+</button>
                              </div>
                            ) : (
                              <button className="add-btn" onClick={() => addToCart(item)}>
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </main>
      </div>

      {/* Sticky Cart Footer with Collapsible Drawer */}
      {totalItems > 0 && (
        <>
          {isCartOpen && (
            <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)} style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 90
            }}>
              <div className="cart-drawer" onClick={(e) => e.stopPropagation()} style={{
                position: 'fixed',
                bottom: '108px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 32px)',
                maxWidth: '560px',
                background: '#ffffff',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 -10px 30px rgba(0,0,0,0.1), 0 20px 40px rgba(0,0,0,0.2)',
                border: '1px solid rgba(0,0,0,0.05)',
                zIndex: 95,
                maxHeight: '60vh',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f5f5f4', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Review Your Order</h3>
                  <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#a8a29e', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.values(cart).map((item) => (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #faf9f6', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="quantity-control" style={{ height: '30px' }}>
                            <button className="qty-btn" style={{ width: '28px' }} onClick={() => removeFromCart(item.id)}>-</button>
                            <span className="qty-text" style={{ fontSize: '12px' }}>{item.quantity}</span>
                            <button className="qty-btn" style={{ width: '28px' }} onClick={() => addToCart(item)} disabled={item.stock !== undefined && item.stock !== null && item.quantity >= item.stock}>+</button>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>₹{item.price * item.quantity}</span>
                      </div>
                      {!(item.category_name && (item.category_name.toLowerCase() === 'drinks' || item.category_name.toLowerCase() === 'beverages')) && (
                        <div className="instructions-area">
                          <div className="quick-notes-container">
                            {['🌶️ Spicy', '🚫 No Onion', '🚫 No Garlic', '🧀 More Cheese', '🧂 Less Salt'].map((option) => {
                              const isSelected = (item.notes || '').includes(option);
                              return (
                                <button
                                  key={option}
                                  className={`quick-note-chip ${isSelected ? 'selected' : ''}`}
                                  onClick={() => toggleQuickNote(item.id, option)}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            type="text"
                            className="cart-item-notes-input"
                            placeholder="Or type other instructions..."
                            value={item.notes || ''}
                            onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="sticky-footer" onClick={() => setIsCartOpen(!isCartOpen)}>
            <div className="cart-summary">
              <span>{totalItems} Item{totalItems > 1 ? 's' : ''} • {isCartOpen ? 'Tap to Close' : 'Tap to Review'}</span>
              <span>₹{totalPrice}</span>
            </div>
            <button
              className="checkout-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckout();
              }}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;

`

---

## 📄 frontend/src/Kitchen.jsx

`javascript
import { useCallback, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { API_URL, IS_MISSING_CONFIG } from './config';
import { io } from 'socket.io-client';

// ─── Helper: compute minutes since a timestamp ───────────────────────────────
function getAgeMinutes(createdAt, now) {
  if (!createdAt) return 0;
  const dateStr = createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`;
  return Math.floor((now - new Date(dateStr).getTime()) / 60000);
}

// ─── Helper: format elapsed time in MM:SS ────────────────────────────────────
function formatElapsed(createdAt, now) {
  if (!createdAt) return '00:00';
  const dateStr = createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`;
  const diffMs = now - new Date(dateStr).getTime();
  if (diffMs < 0) return '00:00';
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${String(remMins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Urgency tier based on age + status ──────────────────────────────────────
function getUrgencyClass(status, ageMinutes) {
  if (status !== 'pending' && status !== 'cooking') return '';
  if (ageMinutes >= 10) return 'urgency-critical';
  if (ageMinutes >= 5) return 'urgency-high';
  return '';
}

// ─── Web Audio chime ─────────────────────────────────────────────────────────
function playChime(volume = 0.5) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    [[523.25, 0, 0.3], [659.25, 0.1, 0.4]].forEach(([freq, delay, stop]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setValueAtTime(0.15 * volume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + stop);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + stop);
    });
  } catch (e) {
    console.error('Audio error:', e);
  }
}

// ─── Recipe Modal Component ──────────────────────────────────────────────────
function RecipeModal({ item, onClose }) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="recipe-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="recipe-modal"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
            exit={{ opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.2 } }}
            onClick={e => e.stopPropagation()}
          >
            <div className="recipe-modal-header">
              <div className="recipe-modal-title-area">
                <span className="recipe-modal-icon">🍳</span>
                <h2 className="recipe-modal-title">{item.name}</h2>
              </div>
              <button className="recipe-modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="recipe-modal-body">
              {item.recipe_instructions ? (
                <div className="recipe-content">
                  <p className="recipe-label">Preparation Instructions</p>
                  <div className="recipe-text">{item.recipe_instructions}</div>
                </div>
              ) : (
                <div className="recipe-empty">
                  <span className="recipe-empty-icon">📋</span>
                  <p>No recipe instructions registered for this dish.</p>
                  <p className="recipe-empty-sub">Instructions can be added via the database editor.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


// ─── Main Kitchen Component ───────────────────────────────────────────────────
function Kitchen() {
  if (IS_MISSING_CONFIG) {
    return (
      <div className="kitchen-container" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Backend Connection Required</h2>
        <p style={{ margin: '15px 0' }}>The kitchen dashboard is deployed, but the backend API URL has not been configured.</p>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Please add the <code>VITE_API_URL</code> environment variable in your site configuration settings.
        </p>
      </div>
    );
  }

  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const s = localStorage.getItem('serveme_kitchen_sound');
    return s !== null ? JSON.parse(s) : true;
  });
  const [volume, setVolume] = useState(() => {
    const v = localStorage.getItem('serveme_kitchen_volume');
    return v !== null ? Number(v) : 0.5;
  });
  const [seenOrderIds, setSeenOrderIds] = useState(new Set());
  const [newOrderIds, setNewOrderIds] = useState([]);
  const [now, setNow] = useState(Date.now());

  const [recipeItem, setRecipeItem] = useState(null); // { name, recipe_instructions }
  const [activeTab, setActiveTab] = useState('pending');

  const params = new URLSearchParams(window.location.search);
  const RESTAURANT_ID = Number(params.get('restaurant_id')) || 1;

  // Clock tick every second for high-precision timer display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(() => {
    fetch(`${API_URL}/restaurants/${RESTAURANT_ID}/orders/`)
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then(data => setOrders(data))
      .catch(err => console.error(err));
  }, [RESTAURANT_ID]);

  // New order detection + chime
  useEffect(() => {
    if (orders.length === 0) return;
    const currentIds = orders.map(o => o.id);
    const newIds = currentIds.filter(id => !seenOrderIds.has(id));
    if (newIds.length > 0) {
      if (seenOrderIds.size > 0 && soundEnabled) playChime(volume);
      if (seenOrderIds.size > 0) {
        setNewOrderIds(prev => [...prev, ...newIds]);
        setTimeout(() => setNewOrderIds(prev => prev.filter(id => !newIds.includes(id))), 5000);
      }
      setSeenOrderIds(prev => { const n = new Set(prev); newIds.forEach(id => n.add(id)); return n; });
    }
  }, [orders, seenOrderIds, soundEnabled, volume]);

  // Socket.io real-time connection
  useEffect(() => {
    fetchOrders();
    const socket = io(API_URL, { path: '/socket.io' });
    socket.on('connect', () => {
      socket.emit('join_restaurant', { restaurant_id: RESTAURANT_ID });
    });
    socket.on('order_update', data => {
      if (data === 'UPDATE_ORDERS') fetchOrders();
    });
    return () => socket.disconnect();
  }, [RESTAURANT_ID, fetchOrders]);

  const updateStatus = async (orderId, newStatus) => {
    const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
          .filter(o => o.status !== 'completed')
    );
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('serveme_kitchen_sound', JSON.stringify(next));
      if (next) playChime(volume);
      return next;
    });
  };

  const handleVolumeChange = e => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    localStorage.setItem('serveme_kitchen_volume', String(v));
    playChime(v);
  };

  // Status-based ordering
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
  const cookingOrders = useMemo(() => orders.filter(o => o.status === 'cooking'), [orders]);
  const readyOrders = useMemo(() => orders.filter(o => o.status === 'ready'), [orders]);

  // General counts
  const pendingCount = pendingOrders.length;
  const cookingCount = cookingOrders.length;
  const readyCount = readyOrders.length;



  const cardVariants = {
    initial: { opacity: 0, scale: 0.92, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, x: -50, scale: 0.95, transition: { duration: 0.2 } }
  };

  const renderOrderCard = (order) => {
    const isNew = newOrderIds.includes(order.id);
    const displayNum = String(order.order_number).padStart(3, '0');
    const ageMinutes = getAgeMinutes(order.created_at, now);
    const elapsedStr = formatElapsed(order.created_at, now);
    const urgencyClass = getUrgencyClass(order.status, ageMinutes);
    const statusClass = order.status.toLowerCase();

    return (
      <motion.div
        key={order.id}
        layout
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`order-card-glass status-${statusClass} ${isNew ? 'new-order-glow' : ''} ${urgencyClass}`}
      >
        {/* Glowing top status bar */}
        <div className={`card-edge edge-${statusClass}`} />

        {/* Card Header */}
        <div className="order-card-header">
          <div className="order-id-area">
            <span className="order-number">#{displayNum}</span>
            <span className="order-age">⏳ {elapsedStr}</span>
          </div>
          <div className={`status-led-group status-${statusClass}`}>
            <span className={`status-led ${urgencyClass ? 'led-urgent' : ''}`} />
            <span className="status-label">{order.status}</span>
          </div>
        </div>

        {/* Order Items */}
        <ul className="order-items-list">
          {order.items.map(item => (
            <li key={item.id}>
              <div className="order-item-line">
                <span className="item-qty">{item.quantity}×</span>
                <div className="order-item-info">
                  <button
                    className="item-name-btn"
                    onClick={() => setRecipeItem({
                      name: item.menu_item_name || `Item #${item.menu_item_id}`,
                      recipe_instructions: item.recipe_instructions
                    })}
                    title="Click to view preparation recipe"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {item.menu_item_name || `Item #${item.menu_item_id}`}
                  </button>
                  {item.notes && (
                    <span className="item-notes">📝 {item.notes}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <div className="order-actions">
          {order.status === 'pending' && (
            <button onClick={() => updateStatus(order.id, 'cooking')} className="btn-pill btn-cooking">
              <span className="btn-icon">🔥</span>
              <span className="btn-text">Start Cooking</span>
            </button>
          )}
          {order.status === 'cooking' && (
            <button onClick={() => updateStatus(order.id, 'ready')} className="btn-pill btn-ready">
              <span className="btn-icon">✅</span>
              <span className="btn-text">Mark Ready</span>
            </button>
          )}
          {order.status === 'ready' && (
            <button onClick={() => updateStatus(order.id, 'completed')} className="btn-pill btn-complete">
              <span className="btn-icon">🤝</span>
              <span className="btn-text">Picked Up</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="kitchen-container">
      {/* ── Recipe Modal Popup ── */}
      <RecipeModal item={recipeItem} onClose={() => setRecipeItem(null)} />

      {/* ── Header ── */}
      <header className="kitchen-header">
        <div className="kitchen-title-area">
          <h1>Kitchen Dashboard</h1>
          <span className="live-indicator">Live</span>
        </div>

        {/* Aggregate Stats */}
        <div className="kitchen-stats">
          <div className="stat-chip pending">
            <span className="stat-dot dot-pending" />
            <span className="label">Pending</span>
            <span className="value">{pendingCount}</span>
          </div>
          <div className="stat-chip cooking">
            <span className="stat-dot dot-cooking" />
            <span className="label">Cooking</span>
            <span className="value">{cookingCount}</span>
          </div>
          <div className="stat-chip ready">
            <span className="stat-dot dot-ready" />
            <span className="label">Ready</span>
            <span className="value">{readyCount}</span>
          </div>

        </div>

        {/* Global Toolbar */}
        <div className="kitchen-header-actions">

          
          <div className="sound-controls">
            <button
              className={`sound-toggle-btn ${!soundEnabled ? 'muted' : ''}`}
              onClick={toggleSound}
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            {soundEnabled && (
              <>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={volume} onChange={handleVolumeChange}
                  className="volume-slider" title="Adjust Volume"
                />

              </>
            )}
          </div>
        </div>
      </header>



      {/* Mobile Kanban Tabs Bar */}
      <div className="mobile-kanban-tabs">
        <button
          className={`kanban-tab-btn tab-pending ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span className="tab-dot dot-pending" />
          <span>Pending ({pendingCount})</span>
        </button>
        <button
          className={`kanban-tab-btn tab-cooking ${activeTab === 'cooking' ? 'active' : ''}`}
          onClick={() => setActiveTab('cooking')}
        >
          <span className="tab-dot dot-cooking" />
          <span>Cooking ({cookingCount})</span>
        </button>
        <button
          className={`kanban-tab-btn tab-ready ${activeTab === 'ready' ? 'active' : ''}`}
          onClick={() => setActiveTab('ready')}
        >
          <span className="tab-dot dot-ready" />
          <span>Ready ({readyCount})</span>
        </button>
      </div>

      {/* ── 3-Column Kanban Board View ── */}
      <div className="kitchen-board-columns">
        
        {/* 1. Pending Column */}
        <div className={`kanban-column column-pending ${activeTab === 'pending' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <div className="column-header">
            <h3>Pending Orders</h3>
            <span className="column-count-badge">{pendingCount}</span>
          </div>
          <div className="column-cards-container">
            <AnimatePresence mode="popLayout">
              {pendingOrders.map(order => renderOrderCard(order))}
            </AnimatePresence>
            {pendingCount === 0 && (
              <div className="column-empty-state">
                <p>No pending orders</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Cooking Column */}
        <div className={`kanban-column column-cooking ${activeTab === 'cooking' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <div className="column-header">
            <h3>Cooking / Preparing</h3>
            <span className="column-count-badge">{cookingCount}</span>
          </div>
          <div className="column-cards-container">
            <AnimatePresence mode="popLayout">
              {cookingOrders.map(order => renderOrderCard(order))}
            </AnimatePresence>
            {cookingCount === 0 && (
              <div className="column-empty-state">
                <p>No active cooking items</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Ready Column */}
        <div className={`kanban-column column-ready ${activeTab === 'ready' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <div className="column-header">
            <h3>Ready for Pickup</h3>
            <span className="column-count-badge">{readyCount}</span>
          </div>
          <div className="column-cards-container">
            <AnimatePresence mode="popLayout">
              {readyOrders.map(order => renderOrderCard(order))}
            </AnimatePresence>
            {readyCount === 0 && (
              <div className="column-empty-state">
                <p>No orders ready yet</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Kitchen;

`

---

## 📄 frontend/src/App.css

`css
/* Base Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background-color: #f7f9fa;
  color: #1a1a1a;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  padding-bottom: 120px; /* Space for the sticky footer */
  background: radial-gradient(circle at top right, #fff4e6, #f7f9fa 40%),
              radial-gradient(circle at bottom left, #e6f7ff, #f7f9fa 40%);
  min-height: 100vh;
}

/* Header */
.header {
  padding: 24px 20px 16px;
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(247, 249, 250, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.header h1 {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Categories Nav (Horizontal Scroll) */
.categories-nav {
  display: flex;
  overflow-x: auto;
  padding: 16px 20px;
  gap: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  position: sticky;
  top: 73px;
  background: rgba(247, 249, 250, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 40;
}

.categories-nav::-webkit-scrollbar {
  display: none;
}

.category-pill {
  padding: 10px 22px;
  background-color: #ffffff;
  color: #555555;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  border-radius: 30px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.category-pill:hover {
  background-color: #fafafa;
  border-color: rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.category-pill.active {
  background: #ff724c; /* Coral-orange color matching the screenshot */
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(255, 114, 76, 0.35);
  transform: translateY(0);
}

/* Search Bar */
.search-container {
  padding: 16px 20px 0;
}

.search-input {
  width: 100%;
  padding: 14px 20px;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 14px;
  font-size: 14px;
  outline: none;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  transition: all 0.3s ease;
}

.search-input:focus {
  border-color: #ff8e53;
  box-shadow: 0 4px 16px rgba(255, 107, 107, 0.1);
}

/* Menu Items */
.menu-list {
  padding: 0 20px;
}

.category-section {
  padding-top: 24px;
}

.category-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 16px;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 24px;
  background: linear-gradient(180deg, #ff6b6b, #ff8e53);
  border-radius: 2px;
}

.menu-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .menu-items-grid {
    grid-template-columns: 1fr;
  }
}

.menu-item-card {
  display: flex;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.04);
  border-radius: 16px;
  padding: 16px;
  gap: 16px;
  align-items: flex-start;
  box-shadow: 0 8px 24px rgba(0,0,0,0.04);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
}

.menu-item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
}

.item-thumbnail {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 16px;
  flex-shrink: 0;
  align-self: flex-start;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.item-name {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}

.item-price {
  font-size: 15px;
  color: #ff6b6b;
  font-weight: 700;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  color: #888888;
  margin-bottom: 4px;
  line-height: 1.4;
}

.more-link {
  font-size: 12px;
  color: #ff8e53;
  text-decoration: none;
  font-weight: 600;
}

.item-action-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 80px;
}

.add-btn {
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 36px;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.25);
}

.add-btn:active {
  transform: scale(0.95);
}

.quantity-control {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border: 1px solid #ff8e53;
  border-radius: 8px;
  overflow: hidden;
  height: 36px;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.1);
}

.qty-btn {
  background-color: #fff0eb;
  color: #ff6b6b;
  border: none;
  width: 36px;
  height: 100%;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.qty-btn:active {
  background-color: #ffe0d4;
}

.qty-text {
  padding: 0 12px;
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

/* Sticky Footer */
.sticky-footer {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 40px);
  max-width: 600px;
  background: rgba(26, 26, 26, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: #ffffff;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.2);
  z-index: 100;
}

.cart-summary {
  display: flex;
  flex-direction: column;
}

.cart-summary span:first-child {
  font-size: 14px;
  color: #a0a0a0;
}

.cart-summary span:last-child {
  font-size: 20px;
  font-weight: 800;
}

.checkout-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 12px 28px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.checkout-btn:active {
  transform: scale(0.96);
}

/* Success Screen */
.success-screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
}

.success-screen h2 {
  font-size: 20px;
  font-weight: 400;
  margin-bottom: 10px;
  color: rgba(255,255,255,0.7);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.giant-number {
  font-size: 96px;
  font-weight: 900;
  margin-bottom: 30px;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53, #ffd93d);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 30px rgba(255, 107, 107, 0.3));
}

.success-screen p {
  font-size: 16px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 8px;
}

/* ============================================================
   KITCHEN COMMAND CENTER
   ============================================================ */

.kitchen-container {
  min-height: 100vh;
  padding: 28px 36px;
  background-color: #04060a;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    radial-gradient(ellipse at 10% 0%, rgba(16, 185, 129, 0.04) 0, transparent 50%),
    radial-gradient(ellipse at 90% 0%, rgba(6, 182, 212, 0.04) 0, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(30, 41, 59, 0.15) 0, transparent 60%);
  background-size: 32px 32px, 32px 32px, 100% 100%, 100% 100%, 100% 100%;
  color: #e2e8f0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* --- Header --- */
.kitchen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.kitchen-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kitchen-header h1 {
  font-family: 'Inter', sans-serif;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #f8fafc;
}

.live-indicator {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(16, 185, 129, 0.12);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.live-indicator::before {
  content: '';
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
  animation: pulse-live 1.5s infinite;
}

@keyframes pulse-live {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.4; }
}

/* --- Stats Bar --- */
.kitchen-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-family: 'JetBrains Mono', monospace;
}

.stat-chip {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: 6px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-pending { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.5); }
.dot-cooking { background: #06b6d4; box-shadow: 0 0 6px rgba(6, 182, 212, 0.5); }
.dot-ready { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }

.stat-chip .label {
  color: #64748b;
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-chip .value {
  font-size: 15px;
  font-weight: 800;
  color: #f1f5f9;
}

.stat-chip.pending .value { color: #fbbf24; }
.stat-chip.cooking .value { color: #22d3ee; }
.stat-chip.ready .value { color: #34d399; }
.stat-chip.prep-time .value { color: #a78bfa; }

/* --- Masonry Grid --- */
.orders-masonry {
  columns: 360px auto;
  column-gap: 20px;
}

/* --- Order Card (Glassmorphism) --- */
.order-card-glass {
  break-inside: avoid;
  margin-bottom: 24px;
  background: rgba(10, 15, 28, 0.65);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.order-card-glass:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  transform: translateY(-2px);
}

/* Glowing top edge */
.card-edge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #334155;
}

.card-edge.edge-pending {
  background: linear-gradient(90deg, #f59e0b, #d97706);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
}

.card-edge.edge-cooking {
  background: linear-gradient(90deg, #06b6d4, #0891b2);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.35);
}

.card-edge.edge-ready {
  background: linear-gradient(90deg, #10b981, #059669);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
}

/* Urgent state (pending > 5 min) */
.order-card-glass.urgent {
  border-color: rgba(245, 158, 11, 0.15);
  animation: urgent-glow 2s ease-in-out infinite;
}

@keyframes urgent-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
  50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.12); }
}

/* New order glow */
.order-card-glass.new-order-glow {
  border-color: rgba(6, 182, 212, 0.2);
  box-shadow: 0 0 25px rgba(6, 182, 212, 0.1);
}

/* --- Card Header --- */
.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.order-id-area {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.order-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -1.5px;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
}

.order-age {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #64748b;
  letter-spacing: 0.3px;
}

/* --- LED Status Indicator --- */
.status-led-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.status-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-pending .status-led {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.status-cooking .status-led {
  background: #06b6d4;
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.6);
}

.status-ready .status-led {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.status-led.led-urgent {
  animation: led-pulse 1s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.4); }
}

.status-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #94a3b8;
}

.status-pending .status-label { color: #fbbf24; }
.status-cooking .status-label { color: #22d3ee; }
.status-ready .status-label { color: #34d399; }

/* --- Order Items --- */
.order-items-list {
  list-style: none;
  margin-bottom: 18px;
  padding: 0;
}

.order-items-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
  font-size: 14px;
}

.order-items-list li:last-child {
  border-bottom: none;
}

.item-qty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.order-card-glass .item-name {
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  color: #cbd5e1;
  font-size: 14px;
}

/* --- Action Bars (Full-Width) --- */
.order-actions {
  display: flex;
  justify-content: stretch;
  margin-top: 20px;
}

.btn-pill {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 14px 20px;
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.btn-icon {
  font-size: 18px;
}

.btn-pill:hover {
  transform: translateY(-2px);
}

.btn-pill:active {
  transform: translateY(0) scale(0.98);
}

.btn-cooking {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.05);
}
.btn-cooking:hover {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 25px rgba(245, 158, 11, 0.2);
}

.btn-ready {
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  color: #22d3ee;
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.05);
}
.btn-ready:hover {
  background: rgba(6, 182, 212, 0.2);
  border-color: rgba(6, 182, 212, 0.6);
  box-shadow: 0 0 25px rgba(6, 182, 212, 0.2);
}

.btn-complete {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.05);
}
.btn-complete:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.6);
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.2);
}

/* --- Empty State --- */
.no-orders {
  color: #64748b;
  font-size: 15px;
  text-align: center;
  padding: 80px 20px;
  background: rgba(15, 23, 42, 0.25);
  border: 1px dashed rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  break-inside: avoid;
}






/* Dietary & Tags */
.veg-indicator {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 14px;
  height: 14px;
  border: 1px solid currentColor;
  margin-right: 8px;
  vertical-align: middle;
}

.veg-indicator.veg {
  color: #43a047;
}

.veg-indicator.non-veg {
  color: #e53935;
}

.veg-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.spicy-icon {
  margin-left: 6px;
  font-size: 16px;
  vertical-align: middle;
}

.item-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  max-width: 120px;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
  color: #666;
  text-transform: uppercase;
  font-weight: 700;
}

.tag-special {
  color: #4caf50;
  border-color: #4caf50;
  background-color: #e8f5e9;
}

.tag-bestseller {
  color: #f44336;
  border-color: #f44336;
  background-color: #ffebee;
}

/* Menu Visibility Dashboard */
.menu-visibility-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding-top: 10px;
}

.admin-category-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.admin-category-title {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 16px;
  color: #111111;
  border-bottom: 1px solid #eeeeee;
  padding-bottom: 8px;
  text-align: left;
}

.admin-menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.admin-menu-card {
  display: flex;
  align-items: center;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  gap: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.admin-menu-card.hidden {
  opacity: 0.65;
  background: #f1f1f1;
  border-color: #dcdcdc;
}

.admin-menu-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
}

.admin-item-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
}

.admin-item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.admin-item-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-item-name {
  font-size: 15px;
  font-weight: 700;
  color: #333333;
}

.admin-item-price {
  font-size: 14px;
  font-weight: 600;
  color: #666666;
}

.admin-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 90px;
}

.admin-visibility-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}

.admin-visibility-badge.visible {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.admin-visibility-badge.hidden {
  background-color: #ffebee;
  color: #c62828;
}

/* Beautiful Animated Switch Toggle */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.toggle-switch-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-switch-slider {
  background-color: #43a047;
}

.toggle-switch input:focus + .toggle-switch-slider {
  box-shadow: 0 0 1px #43a047;
}

.toggle-switch input:checked + .toggle-switch-slider:before {
  transform: translateX(24px);
}

.no-items {
  color: #888888;
  font-style: italic;
  font-size: 14px;
}

/* Sound Controls Container & Volume Slider */
.sound-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(4px);
  padding: 6px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.sound-toggle-btn {
  background-color: transparent !important;
  border: none !important;
  padding: 4px !important;
  font-size: 20px !important;
  cursor: pointer;
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
}

.sound-toggle-btn:hover {
  transform: scale(1.15);
}

.volume-slider {
  width: 90px;
  cursor: pointer;
  accent-color: #10b981;
  height: 6px;
  border-radius: 3px;
  outline: none;
  background: rgba(255, 255, 255, 0.15);
  transition: opacity 0.2s ease;
}

/* Pulsing New Order Card Animation */
@keyframes order-pulse-highlight {
  0% {
    box-shadow: 0 0 0 0px rgba(6, 182, 212, 0.6);
    border-color: #06b6d4;
  }
  50% {
    box-shadow: 0 0 0 20px rgba(6, 182, 212, 0);
    border-color: #06b6d4;
  }
  100% {
    box-shadow: 0 0 0 0px rgba(6, 182, 212, 0);
  }
}

.new-order-pulse {
  animation: order-pulse-highlight 2s ease-in-out infinite;
}

.instructions-area {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.quick-notes-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quick-note-chip {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background-color: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.quick-note-chip:hover {
  background-color: #fafafa;
  color: #334155;
  border-color: rgba(0, 0, 0, 0.1);
}

.quick-note-chip.selected {
  background-color: #fff2ed;
  color: #ff724c;
  border-color: #ff724c;
  box-shadow: 0 2px 6px rgba(255, 114, 76, 0.15);
}

.cart-item-notes-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
  border: 1px dashed #ff724c;
  border-radius: 6px;
  outline: none;
  background-color: #fff9f6;
  color: #333333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: all 0.2s ease;
  resize: none;
  display: block;
}

.cart-item-notes-input::placeholder {
  color: #b3b3b3;
  font-style: italic;
  font-size: 11px;
}

.cart-item-notes-input:focus {
  background-color: #ffffff;
  border-style: solid;
  border-color: #ff724c;
  box-shadow: 0 0 0 2px rgba(255, 114, 76, 0.12);
}

.item-notes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.25);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 6px;
  width: fit-content;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.05);
}

/* --- Kitchen Header Actions & Buttons --- */
.kitchen-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.prep-view-toggle {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.prep-view-toggle:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.prep-view-toggle.active {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
}

/* --- Collapsible Prep View Panel --- */
.prep-view-panel {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 24px;
}

.prep-view-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.5px;
  margin-bottom: 14px;
}

.prep-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prep-item-chip {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', sans-serif;
  transition: border-color 0.2s ease;
}

.prep-item-chip:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.prep-qty {
  font-family: 'JetBrains Mono', monospace;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.prep-name {
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 500;
}

.prep-view-empty {
  color: #64748b;
  font-size: 13px;
  text-align: center;
  font-style: italic;
  padding: 10px 0;
}

/* --- Urgency Tiers --- */
.order-card-glass.urgency-high {
  border-color: rgba(245, 158, 11, 0.35);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.08);
}

.order-card-glass.urgency-critical {
  border-color: rgba(239, 68, 68, 0.45);
  animation: critical-border-pulse 2s infinite ease-in-out;
}

.order-card-glass.urgency-critical .card-edge {
  background: linear-gradient(90deg, #ef4444, #b91c1c);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
}

.order-card-glass.urgency-critical .status-led {
  background: #ef4444 !important;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.8) !important;
}

.order-card-glass.urgency-critical .status-label {
  color: #f87171 !important;
}

@keyframes critical-border-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    border-color: rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.6);
  }
}

/* --- Item Line & Name Button --- */
.order-item-line {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.order-item-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.item-name-btn {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  transition: color 0.15s ease;
  width: 100%;
}

.item-name-btn:hover {
  color: #38bdf8 !important;
  text-decoration: underline;
}

.item-notes {
  font-size: 11px;
  font-style: italic;
  color: #94a3b8;
  letter-spacing: 0.2px;
  display: inline-flex;
  align-items: center;
}

/* --- Recipe Modal --- */
.recipe-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 6, 11, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.recipe-modal {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.recipe-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.recipe-modal-title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recipe-modal-icon {
  font-size: 22px;
}

.recipe-modal-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
}

.recipe-modal-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.recipe-modal-close:hover {
  color: #f8fafc;
}

.recipe-modal-body {
  padding: 24px;
}

.recipe-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  color: #06b6d4;
  letter-spacing: 1px;
  margin-bottom: 12px;
  font-weight: 700;
}

.recipe-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #cbd5e1;
  white-space: pre-wrap;
}

.recipe-empty {
  text-align: center;
  padding: 20px 0;
  color: #64748b;
}

.recipe-empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.recipe-empty-sub {
  font-size: 12px;
  margin-top: 6px;
}

/* Kitchen Dashboard Responsive */
@media (max-width: 768px) {
  .kitchen-container {
    padding: 16px;
  }

  .kitchen-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .kitchen-title-area {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .kitchen-header h1 {
    font-size: 24px;
  }

  .kitchen-stats {
    width: 100%;
    justify-content: space-between;
  }

  .stat-chip {
    flex: 1;
    justify-content: center;
    padding: 8px 6px;
    font-size: 12px;
  }

  .orders-masonry {
    columns: 1;
  }

  .sound-controls {
    align-self: flex-end;
  }
}

/* ============================================================
   KANBAN BOARD VIEW & TABS STYLES
   ============================================================ */
.mobile-kanban-tabs {
  display: none;
}

.kitchen-board-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: flex-start;
  margin-top: 10px;
}

.kanban-column {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 18px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 70vh;
  transition: all 0.3s ease;
}

.kanban-column .column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 8px;
}

.kanban-column .column-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.2px;
}

.column-count-badge {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.column-cards-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 60vh;
}

.column-empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  border: 1px dashed rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  color: #64748b;
  font-size: 13px;
  font-style: italic;
  text-align: center;
}

.column-pending {
  border-top: 3px solid #fbbf24;
}

.column-cooking {
  border-top: 3px solid #22d3ee;
}

.column-ready {
  border-top: 3px solid #34d399;
}

/* Sound controls preview button */
.sound-test-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #94a3b8 !important;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px !important;
  font-weight: 700;
  text-transform: uppercase;
  padding: 4px 8px !important;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: 4px;
}

.sound-test-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #f1f5f9 !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

/* Responsive updates for Kitchen on tablets & mobiles */
@media (max-width: 1024px) {
  .kitchen-board-columns {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .mobile-kanban-tabs {
    display: flex;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    padding: 6px;
    margin-bottom: 24px;
    gap: 6px;
  }

  .kanban-tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 12px 6px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .kanban-tab-btn:hover {
    color: #cbd5e1;
  }

  .kanban-tab-btn.active {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  .kanban-tab-btn .tab-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .kanban-tab-btn.active.tab-pending { border-bottom: 2px solid #fbbf24; }
  .kanban-tab-btn.active.tab-cooking { border-bottom: 2px solid #22d3ee; }
  .kanban-tab-btn.active.tab-ready { border-bottom: 2px solid #34d399; }

  .kanban-column {
    min-height: auto;
  }

  .kanban-column.mobile-hidden {
    display: none !important;
  }

  .kanban-column.mobile-visible {
    display: flex !important;
    width: 100%;
  }

  .column-cards-container {
    min-height: auto;
  }
}

/* ============================================================
   CUSTOMER MENU MOBILE RESPONSIVENESS (QR MENU)
   ============================================================ */
@media (max-width: 480px) {
  /* Restructure cards vertically to prevent squishing */
  .menu-item-card {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
  }
  
  .menu-item-card .item-thumbnail {
    width: 100%;
    height: 140px;
    border-radius: 12px;
  }
  
  .menu-item-card .item-details {
    width: 100%;
  }
  
  .menu-item-card .item-action-area {
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    border-top: 1px dashed rgba(0,0,0,0.06);
    padding-top: 12px;
    margin-top: 6px;
  }
  
  .menu-item-card .add-btn, 
  .menu-item-card .quantity-control {
    width: 110px;
    height: 34px;
  }

  .menu-item-card .qty-btn {
    width: 32px;
  }

  .menu-item-card .item-tags {
    justify-content: flex-start;
    max-width: 100%;
  }

  .cart-item-notes-input {
    width: 100%;
    margin-top: 10px;
  }
}

/* Placeholder Thumbnail for items without images */
.placeholder-thumbnail {
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  border: none;
  border-radius: 16px;
  box-sizing: border-box;
}

/* Side-by-side Layout on Mobile/Phone */
@media (max-width: 768px) {
  /* Use premium Inter font for all mobile elements */
  * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  body {
    background-color: #f8fafc;
  }

  .app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 0;
    background: radial-gradient(circle at top right, #fffdfa, #f8fafc 50%),
                radial-gradient(circle at bottom left, #f0fdf4, #f8fafc 50%);
  }

  /* Glassmorphism Header */
  .header {
    position: static;
    flex-shrink: 0;
    padding: 16px 16px 10px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(241, 245, 249, 0.8);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
  }

  .header h1 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ff5024, #ff8c00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header p {
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #64748b !important;
    margin-top: 1px;
  }

  /* Glassmorphism Search Bar */
  .search-container {
    flex-shrink: 0;
    padding: 6px 16px 12px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(241, 245, 249, 0.8);
  }

  .search-input {
    padding: 10px 16px;
    font-size: 13px;
    border-radius: 12px;
    background: #f1f5f9;
    border: 1px solid transparent;
    box-shadow: none;
    transition: all 0.25s ease;
  }

  .search-input:focus {
    background: #ffffff;
    border-color: #ff724c;
    box-shadow: 0 0 0 3px rgba(255, 114, 76, 0.12);
  }

  /* Flex Layout Split */
  .main-content-layout {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: hidden;
  }

  /* Native Sidebar Tabs */
  .categories-nav {
    display: flex;
    flex-direction: column;
    width: 95px;
    min-width: 95px;
    max-width: 95px;
    height: 100%;
    position: static;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px 0;
    gap: 0;
    background: #f8fafc;
    border-bottom: none;
    border-right: 1px solid rgba(226, 232, 240, 0.8);
    z-index: 40;
    flex-shrink: 0;
  }

  .categories-nav::-webkit-scrollbar {
    width: 0px; /* Hide scrollbar in sidebar for maximum clean look */
    display: none;
  }

  .category-pill {
    padding: 14px 10px;
    width: 100%;
    text-align: center;
    white-space: normal;
    font-size: 12px;
    font-weight: 500;
    border-radius: 0;
    border: none;
    border-left: 3px solid transparent;
    box-shadow: none;
    background-color: transparent;
    line-height: 1.3;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    color: #64748b;
  }

  .category-pill:hover {
    background-color: rgba(0, 0, 0, 0.01);
    transform: none;
  }

  .category-pill.active {
    background: #ffffff;
    color: #ff724c;
    font-weight: 700;
    border-left: 3px solid #ff724c;
    box-shadow: none;
    transform: none;
  }

  /* Menu Grid Area */
  .menu-list {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 12px;
    min-width: 0;
    background: #ffffff;
  }

  .category-section {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: 12px;
  }

  .category-title {
    flex-shrink: 0;
    margin-bottom: 12px;
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .category-title::before {
    height: 18px;
    width: 3px;
    border-radius: 1px;
  }

  .menu-items-grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    padding-bottom: 140px; /* Space for sticky cart sheet */
    padding-top: 2px;
  }

  /* Premium Cards */
  .menu-item-card {
    background: #ffffff;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    padding: 12px;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);
    transition: all 0.2s ease;
  }

  .menu-item-card:hover {
    transform: none;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  }

  .item-thumbnail {
    width: 76px;
    height: 76px;
    border-radius: 14px;
    object-fit: cover;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .item-name {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }

  .item-price {
    font-size: 14px;
    font-weight: 800;
    color: #ff5024;
    margin-bottom: 2px;
  }

  .item-desc {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
    margin-bottom: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Indicators */
  .veg-indicator {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    margin-right: 4px;
  }

  .veg-indicator .dot {
    width: 4px;
    height: 4px;
  }

  .spicy-icon {
    font-size: 12px;
    margin-left: 4px;
  }

  /* Modern Buttons */
  .add-btn {
    background: linear-gradient(135deg, #ff724c, #ff5024);
    color: #ffffff;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    padding: 0 16px;
    height: 28px;
    box-shadow: 0 3px 8px rgba(255, 114, 76, 0.2);
  }

  .add-btn.out-of-stock {
    background: transparent;
    border: 1px solid #cbd5e1;
    color: #94a3b8;
    box-shadow: none;
    font-weight: 500;
  }

  .quantity-control {
    border-radius: 20px;
    border-color: #ff724c;
    height: 28px;
    box-shadow: none;
  }

  .qty-btn {
    width: 28px;
    font-size: 14px;
    background-color: #fff6f3;
    color: #ff724c;
  }

  .qty-text {
    padding: 0 8px;
    font-size: 12px;
  }

  /* Instructions Sub-panel */
  .instructions-area {
    margin-top: 8px;
    gap: 6px;
  }

  .quick-notes-container {
    gap: 4px;
  }

  .quick-note-chip {
    padding: 4px 8px;
    font-size: 9px;
    border-radius: 10px;
  }

  .quick-note-chip.selected {
    box-shadow: 0 1px 4px rgba(255, 114, 76, 0.1);
  }

  .cart-item-notes-input {
    padding: 5px 8px;
    font-size: 10px;
    border-radius: 6px;
  }

  /* Premium Floating Cart Bar */
  .sticky-footer {
    bottom: 16px;
    width: calc(100% - 24px);
    padding: 10px 16px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  .cart-summary span:first-child {
    font-size: 11px;
    color: #94a3b8;
  }

  .cart-summary span:last-child {
    font-size: 16px;
    font-weight: 800;
  }

  .checkout-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 10px;
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.2);
  }

  .placeholder-thumbnail {
    background-color: #f1f5f9;
    border: none;
    border-radius: 14px;
  }
}



`

---

## 📄 frontend/index.html

`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet" />
    <title>ServeMe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

`

---
