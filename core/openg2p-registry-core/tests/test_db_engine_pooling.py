"""Unit tests for master-data pooling and the cached session factory."""

from unittest.mock import MagicMock, patch

import pytest

from openg2p_registry_core import engine as eng


@pytest.fixture(autouse=True)
def reset_engine_singleton():
    previous = eng._engines
    eng._engines = None
    yield
    eng._engines = previous


def test_postgres_engine_kwargs_include_pool_settings():
    kwargs = eng._async_engine_kwargs("postgresql+asyncpg://u:p@localhost/master")
    assert kwargs["pool_pre_ping"] == eng._config.db_pool_pre_ping
    assert kwargs["pool_recycle"] == eng._config.db_pool_recycle
    assert kwargs["pool_size"] == eng._config.db_pool_size
    assert kwargs["max_overflow"] == eng._config.db_pool_max_overflow
    assert "poolclass" not in kwargs


def test_sqlite_engine_kwargs_omit_pool_settings():
    kwargs = eng._async_engine_kwargs("sqlite+aiosqlite:///:memory:")
    assert kwargs == {"echo": eng._config.db_logging}


def test_empty_datasource_omits_pool_settings():
    kwargs = eng._async_engine_kwargs("")
    assert kwargs == {"echo": eng._config.db_logging}


def test_get_engines_does_not_use_nullpool_and_is_singleton():
    fake_engine = MagicMock(name="master_data_engine")
    with patch.object(eng, "create_async_engine", return_value=fake_engine) as create_engine:
        first = eng.get_engines()
        second = eng.get_engines()

    create_engine.assert_called_once()
    assert "poolclass" not in create_engine.call_args.kwargs
    assert create_engine.call_args.kwargs["pool_size"] == eng._config.db_pool_size
    assert create_engine.call_args.kwargs["max_overflow"] == eng._config.db_pool_max_overflow
    assert create_engine.call_args.kwargs["pool_pre_ping"] == eng._config.db_pool_pre_ping
    assert create_engine.call_args.kwargs["pool_recycle"] == eng._config.db_pool_recycle
    assert first is second
    assert first["db_engine_master_data"] is fake_engine
    assert first["db_session_maker_master_data"].kw.get("expire_on_commit") is False


def test_get_master_data_session_maker_reuses_cached_factory():
    fake_engine = MagicMock(name="master_data_engine")
    with patch.object(eng, "create_async_engine", return_value=fake_engine):
        first = eng.get_master_data_session_maker()
        second = eng.get_master_data_session_maker()
    assert first is second
    assert callable(first)
