import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../utils/formatters.dart';

/// Imprime un ticket. Es una interfaz para poder sustituirla en las pruebas (no se prueba la impresión real).
abstract class TicketPrinter {
  Future<void> print(Ticket ticket);
}

/// Dibuja el comprobante en memoria con `pdf` y lo envía al cuadro de impresión del sistema con `printing`.
/// No escribe archivos ni descarga nada.
class PdfTicketPrinter implements TicketPrinter {
  const PdfTicketPrinter();

  @override
  Future<void> print(Ticket ticket) async {
    await Printing.layoutPdf(name: ticket.folio, onLayout: (_) => buildDocument(ticket));
  }

  /// Genera el documento del ticket (varias páginas si hace falta). Público para poder probarlo sin imprimir.
  Future<Uint8List> buildDocument(Ticket ticket) async {
    final document = pw.Document(title: 'Ticket ${ticket.folio}', author: ticket.workshop.name);
    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a5,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => [
          pw.Center(
            child: pw.Column(
              children: [
                pw.Text(ticket.workshop.name, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold), textAlign: pw.TextAlign.center),
                if (ticket.workshop.address.isNotEmpty) pw.Text(ticket.workshop.address, textAlign: pw.TextAlign.center),
                if (ticket.workshop.phone.isNotEmpty) pw.Text('Tel. ${ticket.workshop.phone}'),
              ],
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Divider(),
          _pair('Ticket', ticket.folio),
          _pair('Orden', ticket.orderFolio),
          _pair('Fecha', formatDateTime(ticket.generatedAt)),
          _pair('Cliente', ticket.clientName),
          if (ticket.clientPhone.isNotEmpty) _pair('Teléfono', ticket.clientPhone),
          _pair('Vehículo', '${ticket.vehicleDescription} (${ticket.licensePlate})'),
          _pair('Kilometraje', formatMileage(ticket.mileage)),
          pw.Divider(),
          ..._section('Servicios', ticket.services, ticket.servicesSubtotal),
          ..._section('Mano de obra', ticket.labor, ticket.laborSubtotal),
          ..._section('Refacciones', ticket.parts, ticket.partsSubtotal, withQuantity: true),
          pw.Divider(),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('TOTAL', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
              pw.Text(formatMoney(ticket.total), style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Text('Pagos', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          if (ticket.payments.isEmpty)
            pw.Text('Sin pagos registrados.')
          else
            for (final payment in ticket.payments)
              _row(
                '${payment.method.label}${payment.status == PaymentStatus.pending ? ' (pendiente)' : ''}',
                formatMoney(payment.amount),
              ),
          _pair('Cobrado', formatMoney(ticket.paymentSummary.collected)),
          _pair('Saldo por cobrar', formatMoney(ticket.paymentSummary.balance)),
          _pair('Estado de pago', ticket.paymentSummary.status.label),
          pw.SizedBox(height: 12),
          pw.Center(child: pw.Text('Gracias por su preferencia.')),
        ],
      ),
    );
    return document.save();
  }

  pw.Widget _pair(String label, String value) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 1),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.SizedBox(width: 90, child: pw.Text('$label:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
            pw.Expanded(child: pw.Text(value)),
          ],
        ),
      );

  pw.Widget _row(String label, String value) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 1),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [pw.Expanded(child: pw.Text(label)), pw.SizedBox(width: 8), pw.Text(value)],
        ),
      );

  List<pw.Widget> _section(String title, List<TicketLine> lines, double subtotal, {bool withQuantity = false}) {
    if (lines.isEmpty) {
      return const [];
    }
    return [
      pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
      for (final line in lines)
        _row(
          withQuantity ? '${line.quantity} x ${line.description} (${formatMoney(line.unitPrice)})' : line.description,
          formatMoney(line.amount),
        ),
      _row('Subtotal de ${title.toLowerCase()}', formatMoney(subtotal)),
      pw.SizedBox(height: 6),
    ];
  }
}
