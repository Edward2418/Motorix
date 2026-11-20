import 'dart:io';

/// Error al guardar un reporte; su mensaje ya está listo para mostrarlo a la persona.
class ReportSaveException implements Exception {
  const ReportSaveException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Guarda un reporte exportado. Es una interfaz para poder sustituirla en las pruebas (no se escribe en el disco real).
abstract class ReportSaver {
  /// Guarda [bytes] como [fileName] y devuelve la ruta donde quedó. Lanza [ReportSaveException] si no se puede.
  Future<String> save({required String fileName, required List<int> bytes});
}

/// Guarda el archivo en la carpeta de Descargas de la persona, con `dart:io` (sin selector de archivos ni dependencias).
/// Nunca sobrescribe: si el nombre ya existe agrega « (2)», « (3)»…
class FileReportSaver implements ReportSaver {
  const FileReportSaver({this.directory});

  /// Carpeta de destino; si es `null` se usa la de Descargas del usuario.
  final String? directory;

  String _downloadsDirectory() {
    final home = Platform.environment['USERPROFILE'] ?? Platform.environment['HOME'];
    if (home == null || home.isEmpty) {
      throw const ReportSaveException('No se encontró la carpeta de Descargas de tu usuario.');
    }
    return '$home${Platform.pathSeparator}Downloads';
  }

  @override
  Future<String> save({required String fileName, required List<int> bytes}) async {
    final folder = directory ?? _downloadsDirectory();
    try {
      await Directory(folder).create(recursive: true);
      var file = File('$folder${Platform.pathSeparator}$fileName');
      final dot = fileName.lastIndexOf('.');
      final base = dot > 0 ? fileName.substring(0, dot) : fileName;
      final extension = dot > 0 ? fileName.substring(dot) : '';
      var copy = 2;
      while (await file.exists()) {
        file = File('$folder${Platform.pathSeparator}$base ($copy)$extension');
        copy += 1;
      }
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } on FileSystemException catch (e) {
      throw ReportSaveException(
        e.osError?.errorCode == 5 || e.osError?.errorCode == 13
            ? 'No hay permiso para escribir en la carpeta de Descargas.'
            : 'No se pudo escribir el archivo en $folder.',
      );
    }
  }
}
