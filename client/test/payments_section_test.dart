import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'order_status_actions_test.dart' show orden;

Map<String, dynamic> resumenJson({
  double total = 1000,
  double cobrado = 0,
  double reservado = 0,
  String estado = 'SIN_PAGO',
}) =>
    {
      'total': total,
      'collected': cobrado,
      'reserved': reservado,
      'balance': (total - cobrado).clamp(0, double.infinity),
      'available': (total - cobrado - reservado).clamp(0, double.infinity),
      'creditBalance': 0,
      'status': estado,
    };

Map<String, dynamic> pagoJson({
  int id = 1,
  double importe = 400,
  String metodo = 'EFECTIVO',
  String estado = 'PAGADO',
  String? motivo,
}) =>
    {
      'id': id,
      'orderId': 3,
      'orderFolio': 'OS-2026-0003',
      'amount': importe,
      'method': metodo,
      'status': estado,
      'reference': null,
      'paymentLink': null,
      'expiresAt': null,
      'paidAt': estado == 'PAGADO' ? '2026-10-13T12:00:00.000Z' : null,
      'cancelReason': motivo,
      'createdByName': 'Recepción Uno',
      'cancelledByName': motivo == null ? null : 'Administrador',
      'createdAt': '2026-10-13T12:00:00.000Z',
    };

Map<String, dynamic> ordenTerminada({String estado = 'TERMINADO', Map<String, dynamic>? pago, bool conPago = true}) => {
      ...orden(estado: estado, permitidas: const []),
      'total': 1000,
      if (conPago) 'payment': pago ?? resumenJson(),
    };

Future<List<http.Request>> abrirOrden(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1400, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final log = <http.Request>[];
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
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const OrderDetailScreen(orderId: 3)),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

/// Servidor simulado: detalle de la orden y sus pagos. [alRegistrar] responde al POST de pagos.
FakeHandler servidor({
  required Map<String, dynamic> detalle,
  List<Map<String, dynamic>> pagos = const [],
  Map<String, dynamic>? resumen,
  FakeResponse Function(http.Request)? alRegistrar,
}) =>
    (request) {
      final path = request.url.path;
      if (path.endsWith('/orders/3/payments')) {
        if (request.method == 'POST' && alRegistrar != null) {
          return alRegistrar(request);
        }
        return FakeResponse(200, {
          'data': {'payments': pagos, 'summary': resumen ?? resumenJson()},
        });
      }
      if (path.contains('/payments/') && path.endsWith('/cancel')) {
        return FakeResponse(200, {
          'data': {'payment': pagoJson(estado: 'CANCELADO', motivo: 'x'), 'summary': resumenJson()},
        });
      }
      return FakeResponse(200, {'data': detalle});
    };

Iterable<http.Request> pagosPost(List<http.Request> log) =>
    log.where((r) => r.method == 'POST' && r.url.path.endsWith('/orders/3/payments'));

void main() {
  testWidgets('muestra el resumen de pagos con los datos del servidor', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoJson(importe: 400)],
        resumen: resumenJson(cobrado: 400, estado: 'PARCIAL'),
      ),
    );
    expect(find.text('Pagos'), findsOneWidget);
    expect(find.text('Cobrado'), findsOneWidget);
    expect(find.text(r'$400.00'), findsWidgets);
    expect(find.text(r'$600.00'), findsOneWidget); // Saldo por cobrar
    expect(find.text('Pago parcial'), findsOneWidget);
    expect(find.textContaining('Efectivo · \$400.00'), findsOneWidget);
    expect(find.text('Registrar pago'), findsOneWidget);
  });

  testWidgets('registrar un pago pide confirmación y no llama al servidor si se cancela', (tester) async {
    final log = await abrirOrden(tester, role: 'RECEPTIONIST', handler: servidor(detalle: ordenTerminada()));
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    expect(find.text('Disponible para cobrar: \$1,000.00'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    expect(find.text('Confirmar pago'), findsOneWidget);

    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();
    expect(pagosPost(log), isEmpty);
  });

  testWidgets('al confirmar envía el importe, el método y la referencia, y avisa del resultado', (tester) async {
    final log = await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        alRegistrar: (_) => FakeResponse(201, {
          'data': {'payment': pagoJson(importe: 250), 'summary': resumenJson(cobrado: 250, estado: 'PARCIAL')},
        }),
      ),
    );
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '250');
    await tester.enterText(find.widgetWithText(TextFormField, 'Referencia (opcional)'), 'AUT-1234');
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final cuerpo = jsonDecode(pagosPost(log).single.body) as Map<String, dynamic>;
    expect(cuerpo, {'amount': 250.0, 'method': 'EFECTIVO', 'reference': 'AUT-1234'});
    expect(find.text('Pago registrado.'), findsOneWidget);
  });

  testWidgets('el importe mayor al disponible se rechaza en el formulario sin llamar al servidor', (tester) async {
    final log = await abrirOrden(tester, role: 'ADMIN', handler: servidor(detalle: ordenTerminada()));
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '1500');
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    expect(find.textContaining('supera lo disponible'), findsOneWidget);
    expect(pagosPost(log), isEmpty);
  });

  testWidgets('el error del servidor por importe excedido se muestra en el campo sin cerrar el diálogo', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        alRegistrar: (_) => apiError(
          409,
          'AMOUNT_EXCEEDS_BALANCE',
          'El importe supera lo disponible para cobrar (\$300.00).',
          details: [
            {'field': 'amount', 'message': 'El importe supera lo disponible para cobrar (\$300.00).'},
          ],
        ),
      ),
    );
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.text('El importe supera lo disponible para cobrar (\$300.00).'), findsOneWidget);
    expect(find.text('Registrar pago'), findsWidgets);
  });

  testWidgets('recepción no ve «Cancelar» en un pago cobrado, pero administración sí', (tester) async {
    final pagos = [pagoJson(importe: 400)];
    final resumen = resumenJson(cobrado: 400, estado: 'PARCIAL');
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(detalle: ordenTerminada(), pagos: pagos, resumen: resumen),
    );
    expect(find.byTooltip(RegExp('Cancelar pago')), findsNothing);

    await abrirOrden(tester, role: 'ADMIN', handler: servidor(detalle: ordenTerminada(), pagos: pagos, resumen: resumen));
    expect(find.byTooltip(RegExp('Cancelar pago')), findsOneWidget);
  });

  testWidgets('cancelar un pago pide un motivo', (tester) async {
    final log = await abrirOrden(
      tester,
      role: 'ADMIN',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoJson(importe: 400)],
        resumen: resumenJson(cobrado: 400, estado: 'PARCIAL'),
      ),
    );
    await tester.tap(find.byTooltip(RegExp('Cancelar pago')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar pago'));
    await tester.pumpAndSettle();
    expect(find.text('Indica el motivo.'), findsOneWidget);
    expect(log.where((r) => r.url.path.endsWith('/cancel')), isEmpty);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la cancelación'), 'Error de captura');
    await tester.tap(find.widgetWithText(FilledButton, 'Cancelar pago'));
    await tester.pumpAndSettle();
    final cancelacion = log.singleWhere((r) => r.url.path.endsWith('/cancel'));
    expect(jsonDecode(cancelacion.body), {'reason': 'Error de captura'});
  });

  testWidgets('el mecánico no ve la sección de pagos ni consulta el servidor de pagos', (tester) async {
    final log = await abrirOrden(
      tester,
      role: 'MECHANIC',
      handler: servidor(detalle: ordenTerminada(conPago: false)),
    );
    expect(find.text('Pagos'), findsNothing);
    expect(find.text('Registrar pago'), findsNothing);
    expect(log.where((r) => r.url.path.contains('/payments')), isEmpty);
  });

  testWidgets('una orden abierta no muestra la sección de pagos', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(detalle: ordenTerminada(estado: 'EN_REPARACION')),
    );
    expect(find.text('Pagos'), findsNothing);
  });

  testWidgets('con la orden pagada no se ofrece registrar otro pago', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(pago: resumenJson(cobrado: 1000, estado: 'PAGADA')),
        pagos: [pagoJson(importe: 1000)],
        resumen: resumenJson(cobrado: 1000, estado: 'PAGADA'),
      ),
    );
    expect(find.text('Pagada'), findsOneWidget);
    expect(find.text('Registrar pago'), findsNothing);
  });
}
