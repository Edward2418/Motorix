import 'package:flutter_test/flutter_test.dart';

import 'payments_section_test.dart' show abrirOrden, ordenTerminada, pagoJson, resumenJson, servidor;

/// Pago de Mercado Pago pendiente por $1,250 creado cuando el total de la orden era $1,250.
Map<String, dynamic> _pagoMercadoPago({String estado = 'PENDIENTE', bool desfasado = false}) => {
      ...pagoJson(id: 7, importe: 1250, metodo: 'MERCADO_PAGO', estado: estado),
      'totalAtCreation': 1250,
      'outdated': desfasado,
    };

Map<String, dynamic> _resumen({
  double total = 1350,
  double cobrado = 0,
  double reservado = 0,
  String estado = 'SIN_PAGO',
  bool desfasado = false,
}) =>
    {...resumenJson(total: total, cobrado: cobrado, reservado: reservado, estado: estado), 'hasOutdatedPending': desfasado};

void main() {
  testWidgets('un pago de Mercado Pago desfasado muestra el aviso en la orden, la insignia y la acción de cancelarlo', (tester) async {
    final resumen = _resumen(reservado: 1250, desfasado: true);
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(pago: resumen),
        pagos: [_pagoMercadoPago(desfasado: true)],
        resumen: resumen,
      ),
    );

    expect(find.textContaining('quedó desfasado'), findsOneWidget);
    expect(find.text('Desfasado'), findsOneWidget);
    expect(find.byTooltip('Cancelar pago de \$1,250.00 (Mercado Pago)'), findsOneWidget);
  });

  testWidgets('sin pagos desfasados no aparece ningún aviso de desfase', (tester) async {
    final resumen = _resumen(total: 1000, reservado: 400);
    await abrirOrden(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(
        detalle: ordenTerminada(pago: resumen),
        pagos: [
          {
            ...pagoJson(id: 7, importe: 400, metodo: 'MERCADO_PAGO', estado: 'PENDIENTE'),
            'totalAtCreation': 1000,
            'outdated': false,
          },
        ],
        resumen: resumen,
      ),
    );

    expect(find.textContaining('desfasado'), findsNothing);
    expect(find.text('Desfasado'), findsNothing);
  });

  testWidgets('tras una aprobación tardía muestra la diferencia por cobrar y que el pago quedó por su importe original', (tester) async {
    final resumen = _resumen(cobrado: 1250, estado: 'PARCIAL');
    await abrirOrden(
      tester,
      role: 'ADMIN',
      handler: servidor(
        detalle: ordenTerminada(pago: resumen),
        pagos: [_pagoMercadoPago(estado: 'PAGADO')],
        resumen: resumen,
      ),
    );

    expect(find.textContaining('Diferencia por cobrar'), findsOneWidget);
    expect(find.textContaining('\$100.00'), findsWidgets);
    expect(find.textContaining('importe original'), findsOneWidget);
  });

  testWidgets('el mecánico no ve nada de pagos ni avisos de desfase', (tester) async {
    await abrirOrden(
      tester,
      role: 'MECHANIC',
      handler: servidor(detalle: ordenTerminada(conPago: false), pagos: const []),
    );

    expect(find.text('Pagos'), findsNothing);
    expect(find.textContaining('desfasado'), findsNothing);
  });
}
