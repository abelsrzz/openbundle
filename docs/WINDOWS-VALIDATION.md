# Alcance de la validación Windows

Estado de la vista previa 0.3.0, 14 de octubre de 2026.

## Pruebas iniciales

Se ejecutó una suite en Windows 11 Pro 24H2 x64 con PowerShell 5.1, .NET Framework 4.8 y WinGet 1.6.10121. Completó cuatro casos:

| Caso | Resultado observado |
| --- | --- |
| Simulación de 7-Zip y Notepad++ | Salida 0; no instala aplicaciones. |
| Comando propio de prueba | Salida 0 y marcador esperado. |
| Detención tras un error | Salida 1 del paquete; el segundo comando no se ejecutó. |
| Instalación real de 7-Zip y Notepad++ | Salida 0; ambos resultados del motor indican `ok`. |

Los EXE probados estaban sin firma. Una consulta del inventario de Notepad++ falló, por lo que sigue pendiente corroborar el inventario completo antes/después. Las duraciones incluían intervención del operador y no se presentan como benchmark.

## Correcciones y límites

Las pruebas revelaron problemas con el botón Cerrar y la actualización del progreso en PowerShell 5.1. Se corrigieron el ancho del panel, el reemplazo atómico del archivo de progreso y su lectura compartida. La GUI corregida completó simulaciones de dos y 50 aplicaciones. El harness tuvo un error de conteo de arrays que también se corrigió; la suite integral posterior sigue pendiente.

No se ha validado todo el catálogo ni las siete integraciones incorporadas en su última revisión. También quedan pendientes repetición con versiones actualizadas, MSI directo, WSL, arquitectura, idioma, proxy, conectividad, permisos y reinicios pendientes.

Las ejecuciones por CLI o medio local no acreditan reputación SmartScreen. La descarga y ejecución reales desde navegador, la firma pública y su verificación criptográfica permanecen pendientes. Las protecciones de Windows no deben desactivarse para presentar una prueba como aprobada.

## Reproducir y ampliar

Utiliza un Windows de pruebas con instantánea. Genera un paquete con la versión actual, registra SHA-256, sistema, arquitectura y WinGet; prueba primero `--dry-run` y después la instalación. Comprueba tanto logs del motor como inventario antes/después. Usa instaladores y comandos propios controlados para los casos de error.

Los logs internos, discos de VM, credenciales y notas operativas del laboratorio no forman parte del repositorio público. Publica sólo evidencia revisada y anonimizada. Véanse [TESTING.md](../TESTING.md), [PARITY.md](../PARITY.md) y [SIGNING.md](../SIGNING.md).
