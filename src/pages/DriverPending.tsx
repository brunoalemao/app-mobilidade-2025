import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Send, FileText, CheckCircle } from 'lucide-react';

interface LocationState {
  phone: string;
  documents: string[];
}

const DriverPending = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { phone, documents } = (location.state as LocationState) || { 
    phone: '11999999999',
    documents: [
      'CNH (frente e verso)',
      'Documento do veículo (CRLV)',
      'Foto de perfil (rosto visível)',
      'Certidão de antecedentes criminais'
    ]
  };

  // Se não houver usuário ou o usuário não for motorista, redirecionar
  if (!user || user.role !== 'driver') {
    return <Navigate to="/login" replace />;
  }

  // Se o status do motorista for approved, redirecionar para home
  if (user.status === 'approved') {
    return <Navigate to="/driver/home" replace />;
  }

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent(
      `Olá! Sou ${user.name} e acabei de me cadastrar como motorista. ` +
      `Gostaria de enviar meus documentos para aprovação.\n\n` +
      `Meu ID: ${user.uid}`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Ícone e Status */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Cadastro em Análise
          </h2>
          <p className="text-gray-600">
            Seu cadastro está pendente de aprovação. Envie seus documentos para agilizar o processo.
          </p>
        </div>

        {/* Card de Documentos */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-gray-500" />
              Documentos Necessários
            </h3>
            <ul className="space-y-3">
              {documents.map((doc: string, index: number) => (
                <li key={index} className="flex items-center text-gray-600">
                  <CheckCircle className="w-5 h-5 mr-2 text-gray-400" />
                  {doc}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Botão do WhatsApp */}
        <button
          onClick={handleWhatsAppClick}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center transition-colors"
        >
          <Send className="w-5 h-5 mr-2" />
          Enviar Documentos via WhatsApp
        </button>

        {/* Informações Adicionais */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Após o envio dos documentos, nossa equipe fará a análise em até 24 horas.</p>
          <p className="mt-2">Você receberá um email quando seu cadastro for aprovado.</p>
        </div>
      </div>
    </div>
  );
};

export default DriverPending; 