import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/providers/ticket_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/screens/ticket_screen.dart';
import 'package:motorix_client/services/ticket_printer.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'payments_section_test.dart' show ordenTerminada, pagoJson, resumenJson;

/// Impresora falsa: guarda los tickets que le piden imprimir.
class ImpresoraFalsa implements TicketPrinter {
  final List<Ticket> impresos = [];
  bool fallar = false;

  @override
  Future<void> print(Ticket ticket) async {
    if (fallar) {
      throw Exception('sin impresora');
    }
    impresos.add(ticket);
  }
}

Map<String, dynamic> lineaJson(String descripcion, double importe, {int cantidad = 1, double? precio}) => {
      'description': descripcion,
      'quantity': cantidad,
      'unitPrice': precio ?? importe,
      'amount': importe,
    };

Map<String, dynamic> ticketJson({bool cambio = false}) => {
      'id': 1,
      'folio': 'TK-2026-0007',
      'generatedAt': '2026-10-13T15:30:00.000Z',
      'generatedByName': 'Recepción Uno',
      'orderChangedSinceGenerated': cambio,
      'workshop': {'name': 'Taller Motorix (ejemplo)', 'address': 'Av. Principal 123', 'phone': '55 0000 0000'},
      'order': {'id': 3, 'folio': 'OS-2026-0003', 'status': 'ENTREGADO'},
      'client': {'name': 'Ana Pérez', 'phone': '5551234567'},
      'vehicle': {'description': 'Nissan Versa 2020', 'licensePlate': 'ABC1234', 'mileage': 45800},
      'services': [lineaJson('Cambio de aceite', 600)],
      'labor': [lineaJson('Afinación', 300)],
      'parts': [lineaJson('BUJ-100 · Bujía de iridio', 160, cantidad: 2, precio: 80)],
      'subtotals': {'services': 600, 'labor': 300, 'parts': 160},
      'total': 1060,
      'payments': [pagoJson(importe: 500, metodo: 'TRANSFERENCIA')],
      'paymentSummary': resumenJson(total: 1060, cobrado: 500, estado: 'PARCIAL'),
    };

Future<ImpresoraFalsa> abrir(
  WidgetTester tester, {
  required FakeHandler handler,
  String role = 'RECEPTIONIST',
  Widget home = const TicketScreen(orderId: 3),
  List<http.Request>? log,
}) async {
  tester.view.physicalSize = const Size(1400, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final impresora = ImpresoraFalsa();
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    return handler(request);
  }, log: log);
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
        ChangeNotifierProvider(create: (_) => TicketProvider(api)),
        Provider<TicketPrinter>.value(value: impresora),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: home),
    ),
  );
  await tester.pumpAndSettle();
  return impresora;
}

void main() {
  testWidgets('muestra todos los datos del ticket', (tester) async {
    await abrir(tester, handler: (_) => FakeResponse(200, {'data': ticketJson()}));
    expect(find.text('Ticket TK-2026-0007'), findsWidgets);
    expect(find.text('Taller Motorix (ejemplo)'), findsOneWidget);
    expect(find.text('Av. Principal 123'), findsOneWidget);
    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('Nissan Versa 2020 (ABC1234)'), findsOneWidget);
    expect(find.text('45,800 km'), findsOneWidget);
    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Afinación'), findsOneWidget);
    expect(find.textContaining('2 × BUJ-100 · Bujía de iridio'), findsOneWidget);
    expect(find.text(r'$1,060.00'), findsOneWidget); // total
    expect(find.text('Transferencia'), findsOneWidget);
    expect(find.text(r'$560.00'), findsOneWidget); // saldo por cobrar
    expect(find.text('Pago parcial'), findsOneWidget);
    expect(find.text('La orden se modificó después de generar este ticket. Se muestran los datos vigentes.'), findsNothing);
  });

  testWidgets('avisa cuando la orden cambió después de generar el ticket', (tester) async {
    await abrir(tester, handler: (_) => FakeResponse(200, {'data': ticketJson(cambio: true)}));
    expect(find.text('La orden se modificó después de generar este ticket. Se muestran los datos vigentes.'), findsOneWidget);
  });

  testWidgets('Imprimir envía el ticket a la impresora', (tester) async {
    final impresora = await abrir(tester, handler: (_) => FakeResponse(200, {'data': ticketJson()}));
    await tester.tap(find.text('Imprimir'));
    await tester.pumpAndSettle();
    expect(impresora.impresos.map((t) => t.folio), ['TK-2026-0007']);
  });

  testWidgets('si la impresión falla muestra un mensaje claro', (tester) async {
    final impresora = await abrir(tester, handler: (_) => FakeResponse(200, {'data': ticketJson()}));
    impresora.fallar = true;
    await tester.tap(find.text('Imprimir'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No se pudo abrir la impresión'), findsOneWidget);
  });

  testWidgets('sin ticket ofrece generarlo y lo muestra al generarlo', (tester) async {
    final log = <http.Request>[];
    await abrir(
      tester,
      log: log,
      handler: (request) {
        if (request.method == 'GET') {
          return apiError(404, 'TICKET_NOT_FOUND', 'La orden todavía no tiene ticket.');
        }
        return FakeResponse(201, {'data': ticketJson()});
      },
    );
    expect(find.text('Esta orden todavía no tiene ticket.'), findsOneWidget);
    await tester.tap(find.text('Generar ticket'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/orders/3/ticket')), hasLength(1));
    expect(find.text('Ticket TK-2026-0007'), findsWidgets);
    expect(find.text('Imprimir'), findsOneWidget);
  });

  testWidgets('el error de orden abierta se muestra al intentar generar', (tester) async {
    await abrir(
      tester,
      handler: (request) => request.method == 'GET'
          ? apiError(404, 'TICKET_NOT_FOUND', 'La orden todavía no tiene ticket.')
          : apiError(409, 'ORDER_NOT_TICKETABLE', 'La orden está en estado EN_REPARACION: el ticket solo se genera para una orden terminada o entregada.'),
    );
    await tester.tap(find.text('Generar ticket'));
    await tester.pumpAndSettle();
    expect(find.textContaining('el ticket solo se genera para una orden terminada o entregada'), findsOneWidget);
  });

  testWidgets('un error del servidor permite reintentar', (tester) async {
    await abrir(tester, handler: (_) => apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.'));
    expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('el botón del ticket aparece para recepción en una orden terminada y no para el mecánico', (tester) async {
    FakeResponse servidor(http.Request request) {
      if (request.url.path.endsWith('/orders/3/payments')) {
        return FakeResponse(200, {'data': {'payments': <Object>[], 'summary': resumenJson()}});
      }
      if (request.url.path.endsWith('/payments/config')) {
        return FakeResponse(200, {'data': {'methods': <Object>[], 'mercadoPagoEnabled': false}});
      }
      return FakeResponse(200, {'data': ordenTerminada()});
    }

    await abrir(tester, handler: servidor, home: const OrderDetailScreen(orderId: 3));
    expect(find.text('Ticket de servicio'), findsOneWidget);

    await abrir(tester, role: 'MECHANIC', handler: servidor, home: const OrderDetailScreen(orderId: 3));
    expect(find.text('Ticket de servicio'), findsNothing);
  });
}
