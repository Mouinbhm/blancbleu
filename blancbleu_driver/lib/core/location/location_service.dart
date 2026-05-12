import 'dart:async';
import 'package:geolocator/geolocator.dart';
import '../storage/local_database.dart';

class LocationService {
  static LocationService? _instance;
  static LocationService get instance => _instance ??= LocationService._();
  LocationService._();

  Timer? _timer;
  String? _activeShiftId;
  String? _activeTransportId;

  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) return false;
    }
    if (perm == LocationPermission.deniedForever) return false;
    return true;
  }

  Future<Position?> getCurrentPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (_) {
      return null;
    }
  }

  void startTracking(String shiftId) {
    _activeShiftId = shiftId;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _record());
  }

  void setActiveTransport(String? transportId) => _activeTransportId = transportId;

  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    _activeShiftId = null;
    _activeTransportId = null;
  }

  Future<void> _record() async {
    if (_activeShiftId == null) return;
    final pos = await getCurrentPosition();
    if (pos == null) return;
    await LocalDatabase.instance.queueTrackingPoint(
      lat:         pos.latitude,
      lng:         pos.longitude,
      speed:       pos.speed,
      accuracy:    pos.accuracy,
      shiftId:     _activeShiftId,
      transportId: _activeTransportId,
    );
  }
}
