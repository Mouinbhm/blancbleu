import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/local_database.dart';

// ── States ─────────────────────────────────────────────────────────────────

abstract class StatusState extends Equatable {
  const StatusState();
  @override
  List<Object?> get props => [];
}

class StatusIdle extends StatusState {}

class StatusUpdating extends StatusState {
  final String targetStatus;
  const StatusUpdating(this.targetStatus);
  @override
  List<Object?> get props => [targetStatus];
}

class StatusUpdated extends StatusState {
  final String status;
  const StatusUpdated(this.status);
  @override
  List<Object?> get props => [status];
}

class StatusOfflineQueued extends StatusState {
  final String status;
  const StatusOfflineQueued(this.status);
  @override
  List<Object?> get props => [status];
}

class StatusError extends StatusState {
  final String message;
  const StatusError(this.message);
  @override
  List<Object?> get props => [message];
}

// ── Cubit ─────────────────────────────────────────────────────────────────

class StatusCubit extends Cubit<StatusState> {
  final String transportId;
  String currentStatus;

  StatusCubit({required this.transportId, required this.currentStatus})
      : super(StatusIdle());

  Future<void> update(String newStatus, {String note = ''}) async {
    emit(StatusUpdating(newStatus));
    // Optimistic update
    currentStatus = newStatus;

    try {
      await ApiClient.instance.updateTransportStatus(transportId, newStatus, note: note);
      emit(StatusUpdated(newStatus));
    } catch (_) {
      // Offline — queue locally
      await LocalDatabase.instance.queueStatusUpdate(transportId, newStatus, note);
      emit(StatusOfflineQueued(newStatus));
    }
  }
}
