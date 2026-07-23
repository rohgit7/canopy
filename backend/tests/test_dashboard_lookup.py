from backend.api.main import _get_latest_scan_id


def test_get_latest_scan_id_returns_latest_completed_scan_for_customer():
    from backend.api.main import _scans, _latest_scans_by_customer

    _scans.clear()
    _latest_scans_by_customer.clear()

    _scans['scan-1'] = {'customer_id': 'me', 'status': 'complete'}
    _scans['scan-2'] = {'customer_id': 'me', 'status': 'complete'}
    _scans['scan-3'] = {'customer_id': 'other', 'status': 'complete'}

    _latest_scans_by_customer['me'] = 'scan-2'
    _latest_scans_by_customer['other'] = 'scan-3'

    assert _get_latest_scan_id('me') == 'scan-2'
