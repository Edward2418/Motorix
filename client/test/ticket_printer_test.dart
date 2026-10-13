import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/services/ticket_printer.dart';

import 'payments_section_test.dart' show pagoJson, resumenJson;
import 'ticket_screen_test.dart' show lineaJson, ticketJson;

Ticket ticketGrande({int lineas = 60, String texto = 'Servicio'}) {
  final json = ticketJson();
  json['services'] = [for (var i = 0; i < lineas; i++) lineaJson('$texto número ${i + 1}', 10.0 * (i + 1))];
  json['parts'] = [for (var i = 0; i < lineas; i++) lineaJson('REF-$i · Refacción $i', 20.0 * (i + 1), cantidad: 2, precio: 10.0 * (i + 1))];
  json['payments'] = [pagoJson(importe: 500), pagoJson(id: 2, importe: 100, metodo: 'MERCADO_PAGO', estado: 'PENDIENTE')];
  json['paymentSummary'] = resumenJson(total: 5000, cobrado: 500, reservado: 100, estado: 'PARCIAL');
  return Ticket.fromJson(json);
}

void main() {
  const impresora = PdfTicketPrinter();

  test('el documento del ticket se genera en memoria con contenido', () async {
    final bytes = await impresora.buildDocument(Ticket.fromJson(ticketJson()));
    expect(bytes.length, greaterThan(500));
    // Todo PDF válido empieza con la firma «%PDF».
    expect(String.fromCharCodes(bytes.take(4)), '%PDF');
  });

  test('un ticket con muchas líneas se reparte en varias páginas sin errores', () async {
    final corto = await impresora.buildDocument(Ticket.fromJson(ticketJson()));
    final largo = await impresora.buildDocument(ticketGrande());
    expect(largo.length, greaterThan(corto.length));
  });

  test('los textos muy largos y los caracteres del español no provocan errores', () async {
    final largo = 'Revisión de suspensión, alineación y balanceo con cambio de piezas ${'muy largas ' * 40}ñandú ¿ó?';
    final bytes = await impresora.buildDocument(ticketGrande(lineas: 3, texto: largo));
    expect(bytes, isNotEmpty);
  });

  test('un ticket sin pagos ni líneas también se genera', () async {
    final json = ticketJson();
    json['services'] = <Object>[];
    json['labor'] = <Object>[];
    json['parts'] = <Object>[];
    json['payments'] = <Object>[];
    json['total'] = 0;
    json['subtotals'] = {'services': 0, 'labor': 0, 'parts': 0};
    json['paymentSummary'] = resumenJson(total: 0);
    final bytes = await impresora.buildDocument(Ticket.fromJson(json));
    expect(bytes, isNotEmpty);
  });
}
