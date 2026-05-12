import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDatabase {
  static LocalDatabase? _instance;
  static Database? _db;

  LocalDatabase._();
  static LocalDatabase get instance => _instance ??= LocalDatabase._();

  Future<Database> get db async {
    _db ??= await _init();
    return _db!;
  }

  Future<Database> _init() async {
    final dbPath = await getDatabasesPath();
    return openDatabase(
      join(dbPath, 'blancbleu_driver.db'),
      version: 1,
      onCreate: (db, _) async {
        await db.execute('''
          CREATE TABLE transports (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            synced INTEGER DEFAULT 1,
            updated_at INTEGER DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE status_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transport_id TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT DEFAULT '',
            timestamp INTEGER NOT NULL,
            synced INTEGER DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE tracking_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            speed REAL DEFAULT 0,
            accuracy REAL,
            timestamp INTEGER NOT NULL,
            shift_id TEXT,
            transport_id TEXT,
            synced INTEGER DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            read INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0
          )
        ''');
      },
    );
  }

  // ── Transports ────────────────────────────────────────────────────────────

  Future<void> saveTransports(List<Map<String, dynamic>> transports) async {
    final database = await db;
    final batch = database.batch();
    for (final t in transports) {
      batch.insert(
        'transports',
        {
          'id':         t['_id'] ?? t['id'] ?? '',
          'data':       jsonEncode(t),
          'synced':     1,
          'updated_at': DateTime.now().millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getTransportsForDate(DateTime date) async {
    final database = await db;
    final rows = await database.query('transports', orderBy: 'updated_at DESC');
    final dateStr = date.toIso8601String().substring(0, 10);
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .where((t) {
          final d = (t['dateTransport'] as String? ?? '');
          return d.startsWith(dateStr);
        })
        .toList();
  }

  // ── Status queue ──────────────────────────────────────────────────────────

  Future<void> queueStatusUpdate(String transportId, String status, String note) async {
    final database = await db;
    await database.insert('status_queue', {
      'transport_id': transportId,
      'status':       status,
      'note':         note,
      'timestamp':    DateTime.now().millisecondsSinceEpoch,
      'synced':       0,
    });
  }

  Future<List<Map<String, dynamic>>> getPendingStatusUpdates() async {
    final database = await db;
    return database.query('status_queue', where: 'synced = 0', orderBy: 'timestamp ASC');
  }

  Future<void> markStatusSynced(int id) async {
    final database = await db;
    await database.update('status_queue', {'synced': 1}, where: 'id = ?', whereArgs: [id]);
  }

  // ── Tracking queue ────────────────────────────────────────────────────────

  Future<void> queueTrackingPoint({
    required double lat,
    required double lng,
    required double speed,
    double? accuracy,
    String? shiftId,
    String? transportId,
  }) async {
    final database = await db;
    await database.insert('tracking_queue', {
      'lat':          lat,
      'lng':          lng,
      'speed':        speed,
      'accuracy':     accuracy,
      'timestamp':    DateTime.now().millisecondsSinceEpoch,
      'shift_id':     shiftId,
      'transport_id': transportId,
      'synced':       0,
    });
  }

  Future<List<Map<String, dynamic>>> getPendingTrackingPoints({int limit = 50}) async {
    final database = await db;
    return database.query(
      'tracking_queue',
      where:   'synced = 0',
      orderBy: 'timestamp ASC',
      limit:   limit,
    );
  }

  Future<void> markTrackingPointsSynced(List<int> ids) async {
    if (ids.isEmpty) return;
    final database = await db;
    await database.update(
      'tracking_queue',
      {'synced': 1},
      where: 'id IN (${ids.map((_) => '?').join(',')})',
      whereArgs: ids,
    );
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  Future<void> saveMessage(Map<String, dynamic> msg) async {
    final database = await db;
    await database.insert(
      'messages',
      {
        'id':         msg['id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
        'data':       jsonEncode(msg),
        'read':       0,
        'created_at': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
  }

  Future<List<Map<String, dynamic>>> getMessages() async {
    final database = await db;
    final rows = await database.query('messages', orderBy: 'created_at DESC');
    return rows.map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>).toList();
  }

  Future<int> getUnreadCount() async {
    final database = await db;
    final result = await database.rawQuery('SELECT COUNT(*) as cnt FROM messages WHERE read = 0');
    return (result.first['cnt'] as int?) ?? 0;
  }

  Future<void> markMessagesRead() async {
    final database = await db;
    await database.update('messages', {'read': 1});
  }
}
