"""polymorphic embeddings table

Revision ID: 0004_embeddings
Revises: 0003_citations_pipeline
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_embeddings"
down_revision = "0003_citations_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "embeddings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entity_type", sa.String(length=40), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column(
            "purpose", sa.String(length=40), nullable=False, server_default="semantic"
        ),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("dim", sa.Integer(), nullable=False),
        sa.Column("vector", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "entity_type", "entity_id", "purpose", name="uq_embedding_entity_purpose"
        ),
    )
    op.create_index("ix_embeddings_entity_type", "embeddings", ["entity_type"])
    op.create_index("ix_embeddings_entity_id", "embeddings", ["entity_id"])


def downgrade() -> None:
    op.drop_index("ix_embeddings_entity_id", table_name="embeddings")
    op.drop_index("ix_embeddings_entity_type", table_name="embeddings")
    op.drop_table("embeddings")
