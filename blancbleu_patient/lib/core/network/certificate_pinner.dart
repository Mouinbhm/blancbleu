import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

/// SSL Certificate Pinning for the BlancBleu patient app.
///
/// HOW TO GET THE PRODUCTION FINGERPRINT:
///   openssl s_client -connect api.blancbleu.fr:443 2>/dev/null \
///     | openssl x509 -noout -fingerprint -sha256 \
///     | cut -d= -f2 \
///     | tr -d ':' | tr 'A-F' 'a-f'
///
/// Add both the current and the next certificate fingerprint during rotation.
class CertificatePinner {
  /// SHA-256 fingerprints of trusted server certificates (hex, lowercase, no colons).
  /// Add at least two (current + next) to support certificate rotation without downtime.
  static const _pinnedFingerprints = <String>[
    // TODO: replace with actual production certificate fingerprint before release
    // Example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  ];

  /// Pinning is active only in release mode with at least one configured fingerprint.
  static bool get _pinningEnabled =>
      !kDebugMode && _pinnedFingerprints.isNotEmpty;

  /// Returns an [http.Client] with certificate pinning enabled in release builds.
  ///
  /// In debug mode returns a plain client so development servers (with self-signed
  /// or localhost certs) continue to work without manual cert installation.
  ///
  /// Usage in api_service.dart:
  ///   static final _client = CertificatePinner.createClient();
  ///   final res = await _client.post(...);
  static http.Client createClient() {
    if (!_pinningEnabled) return http.Client();

    final ioClient = HttpClient()
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) {
        final fingerprint = sha256
            .convert(cert.der)
            .toString()
            .replaceAll(':', '');

        final trusted = _pinnedFingerprints.any(
          (pin) => pin.toLowerCase() == fingerprint.toLowerCase(),
        );

        if (!trusted) {
          // Log violations even in release to catch misconfigurations early
          debugPrint(
            '[SSL PINNING] REJECTED certificate for $host:$port\n'
            '  Got fingerprint : $fingerprint\n'
            '  Expected one of : ${_pinnedFingerprints.join(", ")}',
          );
        }

        // true = accept the cert (should only happen when fingerprint matches)
        return trusted;
      };

    return IOClient(ioClient);
  }
}
