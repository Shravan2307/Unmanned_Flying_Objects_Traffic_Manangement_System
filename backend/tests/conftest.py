import pytest
from fastapi.testclient import TestClient
import sys, os, uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app
from database import Base, get_db
from modules.identity.models import Operator
from modules.fleet.models import Drone, DroneFixedWing
from modules.identity.auth import create_access_token

TEST_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# Helper to get a valid token for testing
def get_token(client, license_no, password):
    resp = client.post('/api/auth/login', json={'license_no': license_no, 'password': password})
    if resp.status_code == 200:
        return resp.json()['access_token']
    return None


@pytest.fixture
def world(db_session):
    uid = uuid.uuid4().hex[:6]
    op_fleet = Operator(
        name=f"Test Fleet Op 1 {uid}",
        license_no=f"TEST-FLEET-1-{uid}",
        role="FLEET_OPERATOR",
        password_hash=TEST_PASSWORD_HASH,
    )
    op_other = Operator(
        name=f"Test Fleet Op 2 {uid}",
        license_no=f"TEST-FLEET-2-{uid}",
        role="FLEET_OPERATOR",
        password_hash=TEST_PASSWORD_HASH,
    )
    op_reg = Operator(
        name=f"Test Regulator {uid}",
        license_no=f"TEST-REG-{uid}",
        role="REGULATOR",
        password_hash=TEST_PASSWORD_HASH,
    )
    op_disp = Operator(
        name=f"Test Dispatcher {uid}",
        license_no=f"TEST-DISP-{uid}",
        role="DISPATCHER",
        password_hash=TEST_PASSWORD_HASH,
    )

    db_session.add_all([op_fleet, op_other, op_reg, op_disp])
    db_session.flush()

    d_idle = Drone(
        operator_id=op_fleet.operator_id,
        drone_type="FIXED_WING",
        max_altitude_m=120,
        battery_capacity_pct=90,
        status="IDLE",
    )
    d_busy = Drone(
        operator_id=op_fleet.operator_id,
        drone_type="FIXED_WING",
        max_altitude_m=120,
        battery_capacity_pct=85,
        status="IN_FLIGHT",
    )
    d_other = Drone(
        operator_id=op_other.operator_id,
        drone_type="FIXED_WING",
        max_altitude_m=120,
        battery_capacity_pct=95,
        status="IDLE",
    )

    db_session.add_all([d_idle, d_busy, d_other])
    db_session.flush()

    fw_idle = DroneFixedWing(drone_id=d_idle.drone_id, wingspan_m=2.0)
    fw_busy = DroneFixedWing(drone_id=d_busy.drone_id, wingspan_m=2.0)
    fw_other = DroneFixedWing(drone_id=d_other.drone_id, wingspan_m=2.0)
    db_session.add_all([fw_idle, fw_busy, fw_other])

    db_session.flush()

    token_fleet = create_access_token(op_fleet.operator_id, op_fleet.role)
    token_other = create_access_token(op_other.operator_id, op_other.role)
    token_reg = create_access_token(op_reg.operator_id, op_reg.role)
    token_disp = create_access_token(op_disp.operator_id, op_disp.role)

    return {
        "fleet": op_fleet,
        "other": op_other,
        "reg": op_reg,
        "disp": op_disp,
        "h_fleet": {"Authorization": f"Bearer {token_fleet}"},
        "h_other": {"Authorization": f"Bearer {token_other}"},
        "h_reg": {"Authorization": f"Bearer {token_reg}"},
        "h_disp": {"Authorization": f"Bearer {token_disp}"},
        "d_idle": d_idle,
        "d_busy": d_busy,
        "d_other": d_other,
    }

