/// Roles de acceso del sistema (coinciden con los del backend).
enum UserRole {
  admin('ADMIN', 'Administrador'),
  receptionist('RECEPTIONIST', 'Recepcionista'),
  mechanic('MECHANIC', 'Mecánico');

  const UserRole(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static UserRole fromApi(String value) =>
      UserRole.values.firstWhere((role) => role.apiValue == value, orElse: () => UserRole.mechanic);

  /// Puede registrar y editar clientes y vehículos.
  bool get canManageRecords => this == UserRole.admin || this == UserRole.receptionist;
}

class User {
  const User({
    required this.id,
    required this.username,
    required this.name,
    required this.email,
    required this.role,
    required this.active,
  });

  final int id;
  final String username;
  final String name;
  final String email;
  final UserRole role;
  final bool active;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as int,
        username: json['username'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: UserRole.fromApi(json['role'] as String),
        active: json['active'] as bool,
      );
}
