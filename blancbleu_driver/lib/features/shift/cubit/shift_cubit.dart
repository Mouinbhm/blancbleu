import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/api_client.dart';
import '../../../core/location/location_service.dart';

// ── States ─────────────────────────────────────────────────────────────────

abstract class ShiftState extends Equatable {
  const ShiftState();
  @override
  List<Object?> get props => [];
}

class ShiftIdle extends ShiftState {}
class ShiftLoading extends ShiftState {}

class ShiftActive extends ShiftState {
  final Map<String, dynamic> shift;
  const ShiftActive(this.shift);
  @override
  List<Object?> get props => [shift];
}

class ShiftEnded extends ShiftState {}

class ShiftError extends ShiftState {
  final String message;
  const ShiftError(this.message);
  @override
  List<Object?> get props => [message];
}

// ── Cubit ─────────────────────────────────────────────────────────────────

class ShiftCubit extends Cubit<ShiftState> {
  ShiftCubit() : super(ShiftIdle());

  Future<void> checkActive() async {
    emit(ShiftLoading());
    try {
      final shift = await ApiClient.instance.getActiveShift();
      if (shift != null) {
        LocationService.instance.startTracking(shift['_id'] ?? shift['id'] ?? '');
        emit(ShiftActive(shift));
      } else {
        emit(ShiftIdle());
      }
    } catch (_) {
      emit(ShiftIdle());
    }
  }

  Future<void> start(String vehicleId, Map<String, bool> checklist) async {
    emit(ShiftLoading());
    try {
      final data = await ApiClient.instance.startShift(vehicleId, checklist);
      final shift = data['shift'] as Map<String, dynamic>;
      LocationService.instance.startTracking(shift['_id'] ?? shift['id'] ?? '');
      emit(ShiftActive(shift));
    } catch (e) {
      emit(ShiftError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> end({int totalKm = 0, String notes = ''}) async {
    emit(ShiftLoading());
    try {
      await ApiClient.instance.endShift(totalKm: totalKm, notes: notes);
      LocationService.instance.stopTracking();
      emit(ShiftEnded());
    } catch (e) {
      emit(ShiftError(e.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> addIncident(String description) async {
    try {
      await ApiClient.instance.addIncident(description);
    } catch (_) {}
  }
}
