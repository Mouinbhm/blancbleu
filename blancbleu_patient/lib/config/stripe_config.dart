import 'package:flutter_dotenv/flutter_dotenv.dart';

class StripeConfig {
  static String get publishableKey =>
      dotenv.env['STRIPE_PUBLISHABLE_KEY'] ?? '';
}
