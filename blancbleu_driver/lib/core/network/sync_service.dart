import '../network/api_client.dart';
import '../storage/local_database.dart';

class SyncService {
  static SyncService? _instance;
  static SyncService get instance => _instance ??= SyncService._();
  SyncService._();

  bool _syncing = false;

  Future<void> sync({String? date}) async {
    if (_syncing) return;
    _syncing = true;
    try {
      await _syncStatusQueue();
      await _syncTrackingQueue();
      await _refreshTournee(date: date);
    } catch (_) {
      // non-bloquant
    } finally {
      _syncing = false;
    }
  }

  Future<void> _syncStatusQueue() async {
    final pending = await LocalDatabase.instance.getPendingStatusUpdates();
    for (final row in pending) {
      try {
        await ApiClient.instance.updateTransportStatus(
          row['transport_id'] as String,
          row['status'] as String,
          note: row['note'] as String? ?? '',
        );
        await LocalDatabase.instance.markStatusSynced(row['id'] as int);
      } catch (_) {
        break; // stop on first failure — retry next sync
      }
    }
  }

  Future<void> _syncTrackingQueue() async {
    final pending = await LocalDatabase.instance.getPendingTrackingPoints(limit: 50);
    if (pending.isEmpty) return;
    try {
      final points = pending.map((r) => {
        'lat':         r['lat'],
        'lng':         r['lng'],
        'speed':       r['speed'],
        'accuracy':    r['accuracy'],
        'timestamp':   DateTime.fromMillisecondsSinceEpoch(r['timestamp'] as int).toIso8601String(),
        'transportId': r['transport_id'],
      }).toList();
      await ApiClient.instance.batchTracking(points);
      final ids = pending.map((r) => r['id'] as int).toList();
      await LocalDatabase.instance.markTrackingPointsSynced(ids);
    } catch (_) {}
  }

  Future<void> _refreshTournee({String? date}) async {
    final dateStr = date ?? DateTime.now().toIso8601String().substring(0, 10);
    try {
      final data = await ApiClient.instance.getTournee(dateStr);
      final transports = (data['transports'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      await LocalDatabase.instance.saveTransports(transports);
    } catch (_) {}
  }
}
