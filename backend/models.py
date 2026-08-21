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


class DiningTable(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    capacity = Column(Integer, default=4)
    qr_token = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    COOKING = "cooking"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    order_number = Column(Integer, nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="SET NULL"), nullable=True)
    table_number = Column(Integer, nullable=True)
    table_name = Column(String(100), nullable=True)
    qr_token = Column(String(255), nullable=True)
    total_amount = Column(Float, nullable=False)
    status = Column(
        String(50),
        nullable=False,
        default="pending",
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    restaurant = relationship("Restaurant")
    table = relationship("DiningTable")
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
