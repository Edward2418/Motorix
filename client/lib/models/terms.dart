/// Versión vigente de los términos y condiciones y del aviso de privacidad.
class TermsInfo {
  const TermsInfo({
    required this.version,
    required this.termsText,
    required this.privacyText,
    required this.publishedAt,
    required this.accepted,
  });

  factory TermsInfo.fromJson(Map<String, dynamic> json) => TermsInfo(
        version: json['version'] as int,
        termsText: json['termsText'] as String,
        privacyText: json['privacyText'] as String,
        publishedAt: DateTime.parse(json['publishedAt'] as String).toLocal(),
        accepted: json['accepted'] as bool? ?? false,
      );

  final int version;
  final String termsText;
  final String privacyText;
  final DateTime publishedAt;

  /// Si la persona con la sesión abierta ya aceptó esta versión. La consulta pública, sin sesión, no lo informa.
  final bool accepted;
}

/// Una aceptación de los términos: quién, qué versión y cuándo (solo lectura, para administración).
class TermsAcceptanceRow {
  const TermsAcceptanceRow({
    required this.userId,
    required this.userName,
    required this.username,
    required this.version,
    required this.acceptedAt,
  });

  factory TermsAcceptanceRow.fromJson(Map<String, dynamic> json) => TermsAcceptanceRow(
        userId: json['userId'] as int,
        userName: json['userName'] as String,
        username: json['username'] as String,
        version: json['version'] as int,
        acceptedAt: DateTime.parse(json['acceptedAt'] as String).toLocal(),
      );

  final int userId;
  final String userName;
  final String username;
  final int version;
  final DateTime acceptedAt;
}
