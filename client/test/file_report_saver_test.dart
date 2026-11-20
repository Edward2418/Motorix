import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/services/report_saver.dart';

void main() {
  late Directory carpeta;

  setUp(() async {
    carpeta = await Directory.systemTemp.createTemp('motorix-reportes-');
  });

  tearDown(() async {
    await carpeta.delete(recursive: true);
  });

  test('escribe los bytes tal cual, con su marca BOM, y devuelve la ruta', () async {
    final saver = FileReportSaver(directory: carpeta.path);
    final bytes = [0xEF, 0xBB, 0xBF, ...'Sección,Total\r\n'.codeUnits];

    final ruta = await saver.save(fileName: 'ingresos-2026-10-01-a-2026-10-31.csv', bytes: bytes);

    expect(ruta, startsWith(carpeta.path));
    expect(ruta, endsWith('ingresos-2026-10-01-a-2026-10-31.csv'));
    expect(await File(ruta).readAsBytes(), bytes);
  });

  test('nunca sobrescribe: si el nombre existe agrega (2), (3)…', () async {
    final saver = FileReportSaver(directory: carpeta.path);

    final primera = await saver.save(fileName: 'ingresos.csv', bytes: [1]);
    final segunda = await saver.save(fileName: 'ingresos.csv', bytes: [2]);
    final tercera = await saver.save(fileName: 'ingresos.csv', bytes: [3]);

    expect(primera.endsWith('ingresos.csv'), isTrue);
    expect(segunda.endsWith('ingresos (2).csv'), isTrue);
    expect(tercera.endsWith('ingresos (3).csv'), isTrue);
    expect(await File(primera).readAsBytes(), [1], reason: 'el archivo original no se tocó');
  });

  test('crea la carpeta de destino si todavía no existe', () async {
    final destino = '${carpeta.path}${Platform.pathSeparator}nueva${Platform.pathSeparator}Descargas';
    final ruta = await FileReportSaver(directory: destino).save(fileName: 'r.csv', bytes: [9]);

    expect(await File(ruta).readAsBytes(), [9]);
  });

  test('si no se puede escribir lanza un error con un mensaje claro', () async {
    // Una «carpeta» que en realidad es un archivo: crear dentro de ella falla en cualquier sistema.
    final archivo = File('${carpeta.path}${Platform.pathSeparator}no-es-carpeta');
    await archivo.writeAsBytes([0]);

    await expectLater(
      FileReportSaver(directory: archivo.path).save(fileName: 'r.csv', bytes: [1]),
      throwsA(isA<ReportSaveException>().having((e) => e.message, 'mensaje', contains('No se pudo escribir'))),
    );
  });
}
