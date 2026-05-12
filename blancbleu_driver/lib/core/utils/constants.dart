class AppConstants {
  static const String baseUrl     = String.fromEnvironment('API_URL', defaultValue: 'http://192.168.1.56:5000');
  static const String apiBase     = '$baseUrl/api/v1';
  static const String wsUrl       = String.fromEnvironment('WS_URL',  defaultValue: 'ws://192.168.1.56:5000');
  static const String tokenKey    = 'driver_token';
  static const String userKey     = 'driver_user';
  static const int    syncInterval = 300; // seconds
}
