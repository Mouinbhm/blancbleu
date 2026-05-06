class StripeConfig {
  // Remplacer par votre clé publique Stripe (Dashboard → Développeurs → Clés API)
  static const String publishableKey = String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
    defaultValue: 'pk_test_51TU8dHPbnSVwmZGdpmROig6qCIj6dmpUSl4Fg12MVennqrtkdWFdFsmjTObY5grJc9iSlb6AulVkW8sH0FMOshzq00pFfCKwHU',
  );
}
