import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'helpers/fake_api.dart';
import 'payments_section_test.dart' show abrirOrden, ordenTerminada, pagoJson, resumenJson, servidor;

Map<String, dynamic> pagoMercadoPago({
  int id = 9,
  double importe = 400,
  String estado = 'PENDIENTE',
  String? enlace = 'https://sandbox.mercadopago.test/checkout/pref-1',
}) =>
    {
      ...pagoJson(id: id, importe: importe, metodo: 'MERCADO_PAGO', estado: estado),
      'paymentLink': estado == 'PENDIENTE' ? enlace : null,
      'expiresAt': '2026-10-14T12:00:00.000Z',
    };

Iterable<http.Request> actualizaciones(List<http.Request> log) => log.where((r) => r.url.path.endsWith('/refresh'));

Future<void> elegirMercadoPago(WidgetTester tester) async {
  await tester.tap(find.text('Efectivo'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mercado Pago').last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('con Mercado Pago configurado se crea el pago y se muestra el enlace para copiarlo', (tester) async {
    final copiado = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copiado.add((call.arguments as Map)['text'] as String);
      }
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    final log = await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        mercadoPago: true,
        detalle: ordenTerminada(),
        alRegistrar: (_) => FakeResponse(201, {
          'data': {'payment': pagoMercadoPago(), 'summary': resumenJson(reservado: 400)},
        }),
      ),
    );
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await elegirMercadoPago(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final cuerpo = jsonDecode(log.singleWhere((r) => r.method == 'POST' && r.url.path.endsWith('/orders/3/payments')).body);
    expect(cuerpo['method'], 'MERCADO_PAGO');
    expect(find.text('Enlace de pago de Mercado Pago'), findsOneWidget);
    expect(find.text('https://sandbox.mercadopago.test/checkout/pref-1'), findsOneWidget);
    expect(find.textContaining('Vence el'), findsOneWidget);

    await tester.tap(find.text('Copiar enlace'));
    await tester.pumpAndSettle();
    expect(copiado, ['https://sandbox.mercadopago.test/checkout/pref-1']);
    expect(find.text('Enlace copiado.'), findsOneWidget);
  });

  testWidgets('sin configuración la opción de Mercado Pago aparece deshabilitada', (tester) async {
    await abrirOrden(tester, role: 'ADMIN', handler: servidor(detalle: ordenTerminada()));
    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Efectivo'));
    await tester.pumpAndSettle();
    expect(find.text('Mercado Pago (no configurado)'), findsOneWidget);
    expect(find.text('Tarjeta'), findsWidgets);
    expect(find.text('Transferencia'), findsWidgets);
  });

  testWidgets('«Actualizar estado» refleja la aprobación del pago', (tester) async {
    final log = await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoMercadoPago()],
        resumen: resumenJson(reservado: 400),
        alActualizar: (_) => FakeResponse(200, {
          'data': {
            'payment': pagoMercadoPago(estado: 'PAGADO'),
            'summary': resumenJson(cobrado: 400, estado: 'PARCIAL'),
            'warning': null,
          },
        }),
      ),
    );
    // Al abrir la orden ya se actualizó una vez en silencio.
    final previas = actualizaciones(log).length;
    await tester.tap(find.byTooltip(RegExp('Actualizar estado')));
    await tester.pumpAndSettle();
    expect(actualizaciones(log).length, previas + 1);
    expect(find.text('Pago cobrado.'), findsOneWidget);
  });

  testWidgets('si Mercado Pago aún no confirma muestra el aviso de pago pendiente', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoMercadoPago()],
        resumen: resumenJson(reservado: 400),
        alActualizar: (_) => FakeResponse(200, {
          'data': {'payment': pagoMercadoPago(), 'summary': resumenJson(reservado: 400), 'warning': 'STILL_PENDING'},
        }),
      ),
    );
    await tester.tap(find.byTooltip(RegExp('Actualizar estado')));
    await tester.pumpAndSettle();
    expect(find.textContaining('todavía no confirma el pago'), findsOneWidget);
  });

  testWidgets('un error 503 al actualizar se muestra sin romper la pantalla', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoMercadoPago()],
        resumen: resumenJson(reservado: 400),
        alActualizar: (_) => apiError(503, 'SERVICE_UNAVAILABLE', 'Mercado Pago no está disponible en este momento.'),
      ),
    );
    await tester.tap(find.byTooltip(RegExp('Actualizar estado')));
    await tester.pumpAndSettle();
    expect(find.text('Mercado Pago no está disponible en este momento.'), findsOneWidget);
    expect(find.text('Pagos'), findsOneWidget);
    expect(find.text('Pendiente'), findsOneWidget);
  });

  testWidgets('al abrir una orden con un pago de Mercado Pago pendiente se actualiza una vez en silencio', (tester) async {
    final log = await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoMercadoPago(), pagoJson(id: 1, importe: 100)],
        resumen: resumenJson(cobrado: 100, reservado: 400, estado: 'PARCIAL'),
        alActualizar: (_) => FakeResponse(200, {
          'data': {'payment': pagoMercadoPago(), 'summary': resumenJson(reservado: 400), 'warning': 'STILL_PENDING'},
        }),
      ),
    );
    expect(actualizaciones(log), hasLength(1));
    // Sin aviso en pantalla: la actualización silenciosa no molesta al usuario.
    expect(find.textContaining('todavía no confirma'), findsNothing);
  });

  testWidgets('un pago de Mercado Pago pendiente permite ver su enlace y cancelarlo, y uno cobrado no', (tester) async {
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(),
        pagos: [pagoMercadoPago(), pagoMercadoPago(id: 10, importe: 200, estado: 'PAGADO')],
        resumen: resumenJson(cobrado: 200, reservado: 400, estado: 'PARCIAL'),
        alActualizar: (_) => FakeResponse(200, {
          'data': {'payment': pagoMercadoPago(), 'summary': resumenJson(reservado: 400), 'warning': 'STILL_PENDING'},
        }),
      ),
    );
    expect(find.byTooltip(RegExp('Ver enlace de pago')), findsOneWidget);
    expect(find.byTooltip(RegExp('Actualizar estado')), findsOneWidget);
    expect(find.byTooltip(RegExp('Cancelar pago')), findsOneWidget); // solo el pendiente para recepción
  });
}
