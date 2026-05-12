part of 'tournee_cubit.dart';

abstract class TourneeState extends Equatable {
  const TourneeState();
  @override
  List<Object?> get props => [];
}

class TourneeInitial extends TourneeState {}
class TourneeLoading extends TourneeState {}

class TourneeLoaded extends TourneeState {
  final List<Map<String, dynamic>> transports;
  final String date;
  final bool isOffline;
  const TourneeLoaded({required this.transports, required this.date, this.isOffline = false});

  TourneeLoaded copyWith({List<Map<String, dynamic>>? transports, bool? isOffline}) =>
      TourneeLoaded(transports: transports ?? this.transports, date: date, isOffline: isOffline ?? this.isOffline);

  @override
  List<Object?> get props => [transports, date, isOffline];
}

class TourneeError extends TourneeState {
  final String message;
  const TourneeError(this.message);
  @override
  List<Object?> get props => [message];
}
