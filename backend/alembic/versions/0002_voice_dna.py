"""voice dna + ai suggestion telemetry tables

Revision ID: 0002_voice_dna
Revises: 0001_initial
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_voice_dna"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brand_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("style_features", sa.JSON(), nullable=False),
        sa.Column("bigram_signature", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "voice_samples",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "brand_profile_id",
            sa.Uuid(),
            sa.ForeignKey("brand_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=200), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_voice_samples_brand_profile_id", "voice_samples", ["brand_profile_id"]
    )

    op.create_table(
        "ai_suggestions",
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
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("output", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("voice_match_score", sa.Integer(), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_ai_suggestions_document_id", "ai_suggestions", ["document_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ai_suggestions_document_id", table_name="ai_suggestions")
    op.drop_table("ai_suggestions")
    op.drop_index("ix_voice_samples_brand_profile_id", table_name="voice_samples")
    op.drop_table("voice_samples")
    op.drop_table("brand_profiles")
