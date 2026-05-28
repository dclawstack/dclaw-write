"""citations + multi-agent draft pipeline

Revision ID: 0003_citations_pipeline
Revises: 0002_voice_dna
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_citations_pipeline"
down_revision = "0002_voice_dna"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "citations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("paragraph_index", sa.Integer(), nullable=True),
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=2000), nullable=False),
        sa.Column("source_title", sa.String(length=500), nullable=True),
        sa.Column("source_snippet", sa.Text(), nullable=True),
        sa.Column(
            "verified", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_citations_document_id", "citations", ["document_id"])

    op.create_table(
        "draft_pipelines",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "brand_profile_id",
            sa.Uuid(),
            sa.ForeignKey("brand_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("topic", sa.Text(), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_step", sa.String(length=40), nullable=True),
        sa.Column("artifacts", sa.JSON(), nullable=False),
        sa.Column("final_draft", sa.Text(), nullable=False, server_default=""),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_draft_pipelines_document_id", "draft_pipelines", ["document_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_draft_pipelines_document_id", table_name="draft_pipelines")
    op.drop_table("draft_pipelines")
    op.drop_index("ix_citations_document_id", table_name="citations")
    op.drop_table("citations")
