import asyncio
from unittest.mock import patch
from backend.api.main import get_dashboard

@patch("backend.api.main.get_latest_complete_scan")
def test_get_dashboard_returns_latest_scan(mock_get_scan):
    mock_get_scan.return_value = {
        "scan_id": "scan-123",
        "user_id": "me",
        "status": "complete",
        "score": 92.5
    }

    res = asyncio.run(get_dashboard("me"))
    assert res["scan_id"] == "scan-123"
    assert res["status"] == "complete"



