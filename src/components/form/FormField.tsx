import React from 'react';
import { UseFormRegister } from 'react-hook-form';
import { LucideIcon } from 'lucide-react';

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: LucideIcon;
  register: UseFormRegister<any>;
  error?: { message?: string };
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  type,
  placeholder,
  icon: Icon,
  register,
  error,
  className = ''
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon size={18} className="text-gray-400" />
        </div>
        <input
          id={id}
          type={type}
          className={`input pl-10 ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
          placeholder={placeholder}
          {...register(id)}
        />
      </div>
      {error && error.message && (
        <p className="text-error-600 text-sm">{error.message}</p>
      )}
    </div>
  );
};

export default FormField; 