// Utilidades de formato en español, sin dependencias externas.

const List<String> _months = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _two(int value) => value.toString().padLeft(2, '0');

/// Importe con dos decimales, separador de miles y símbolo de peso: `$1,234.50`.
String formatMoney(double amount) {
  final negative = amount < 0;
  final fixed = amount.abs().toStringAsFixed(2);
  final parts = fixed.split('.');
  final digits = parts[0];
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  return '${negative ? '-' : ''}\$$buffer.${parts[1]}';
}

/// Fecha corta: `13 oct 2026`.
String formatDate(DateTime date) => '${date.day} ${_months[date.month - 1]} ${date.year}';

/// Hora de 24 horas: `15:30`.
String formatTime(DateTime date) => '${_two(date.hour)}:${_two(date.minute)}';

/// Fecha y hora: `13 oct 2026, 15:30`.
String formatDateTime(DateTime date) => '${formatDate(date)}, ${formatTime(date)}';

/// Kilometraje con separador de miles: `45,000 km`.
String formatMileage(int km) {
  final digits = km.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  return '$buffer km';
}

/// Cantidad entera con separador de miles: `1,250`.
String formatQuantity(int quantity) {
  final digits = quantity.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  return '${quantity < 0 ? '-' : ''}$buffer';
}
