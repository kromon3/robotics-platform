import { Component } from 'react';

// Если что-то внутри визуализации упало — показываем сообщение, а не белый экран
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="err"><b>Не удалось построить визуализацию.</b><br />{String(this.state.error.message || this.state.error)}<br /><small>Проверьте формат ответа расчёта (src/contract/schema.js).</small></div>;
  }
}
