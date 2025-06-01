import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertProps {
  type: AlertType;
  message: string;
  className?: string;
}

const Alert = ({ type, message, className = '' }: AlertProps) => {
  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-success-50',
          border: 'border-success-200',
          text: 'text-success-700',
          icon: <CheckCircle size={20} className="mr-2 flex-shrink-0" />
        };
      case 'error':
        return {
          bg: 'bg-error-50',
          border: 'border-error-200',
          text: 'text-error-700',
          icon: <AlertCircle size={20} className="mr-2 flex-shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-warning-50',
          border: 'border-warning-200',
          text: 'text-warning-700',
          icon: <XCircle size={20} className="mr-2 flex-shrink-0" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-info-50',
          border: 'border-info-200',
          text: 'text-info-700',
          icon: <Info size={20} className="mr-2 flex-shrink-0" />
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <div className={`p-4 ${styles.bg} border ${styles.border} ${styles.text} rounded-lg animate-fade-in flex items-center ${className}`}>
      {styles.icon}
      {message}
    </div>
  );
};

export default Alert; 