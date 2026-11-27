/// Error al guardar un reporte; su mensaje ya está listo para mostrarlo a la persona.
class ReportSaveException implements Exception {
  const ReportSaveException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Guarda un reporte exportado. Es una interfaz para poder sustituirla en las pruebas (no se escribe en el disco real).
abstract class ReportSaver {
  /// Guarda [bytes] como [fileName] y devuelve la ruta o el nombre con el que quedó. Lanza [ReportSaveException] si no
  /// se puede.
  Future<String> save({required String fileName, required List<int> bytes});
}
