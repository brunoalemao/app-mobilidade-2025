import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  vehicle?: {
    model: string;
    plate: string;
    year: string;
    color: string;
  };
  documents?: {
    cnh: string;
    photo: string;
    criminalRecord: string;
  };
}

const Drivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const driversRef = collection(db, 'drivers');
      const driversSnapshot = await getDocs(driversRef);
      const loadedDrivers = driversSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Driver[];
      setDrivers(loadedDrivers);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (driverId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      const driverDoc = await getDoc(driverRef);
      
      if (!driverDoc.exists()) {
        toast.error('Motorista não encontrado');
        return;
      }

      const driverData = driverDoc.data();
      
      // Verificar se os dados do veículo estão completos antes de aprovar
      if (newStatus === 'approved' && (!driverData.vehicle || !driverData.vehicle.model || !driverData.vehicle.plate || !driverData.vehicle.color)) {
        toast.error('Dados do veículo incompletos. Não é possível aprovar o motorista.');
        return;
      }

      await updateDoc(driverRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      toast.success(`Motorista ${newStatus === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso`);
      loadDrivers();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do motorista');
    }
  };

  const handleViewDetails = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Aprovado
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} className="mr-1" />
            Rejeitado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} className="mr-1" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gerenciamento de Motoristas</h1>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando motoristas...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Telefone</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(driver => (
                <tr key={driver.id} className="border-b">
                  <td className="py-3 px-4">{driver.name}</td>
                  <td className="py-3 px-4">{driver.email}</td>
                  <td className="py-3 px-4">{driver.phone}</td>
                  <td className="py-3 px-4">
                    {getStatusBadge(driver.status)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleViewDetails(driver)}
                      className="btn-secondary text-sm mr-2"
                    >
                      Detalhes
                    </button>
                    {driver.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(driver.id, 'approved')}
                          className="btn-success text-sm mr-2"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleStatusChange(driver.id, 'rejected')}
                          className="btn-error text-sm"
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalhes do Motorista */}
      {showDetailsModal && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Detalhes do Motorista</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedDriver(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700">Informações Pessoais</h4>
                  <div className="mt-2 space-y-2">
                    <p><span className="font-medium">Nome:</span> {selectedDriver.name}</p>
                    <p><span className="font-medium">Email:</span> {selectedDriver.email}</p>
                    <p><span className="font-medium">Telefone:</span> {selectedDriver.phone}</p>
                    <p><span className="font-medium">Status:</span> {getStatusBadge(selectedDriver.status)}</p>
                    <p><span className="font-medium">Data de Cadastro:</span> {selectedDriver.createdAt.toDate().toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedDriver.vehicle && (
                  <div>
                    <h4 className="font-medium text-gray-700">Informações do Veículo</h4>
                    <div className="mt-2 space-y-2">
                      <p><span className="font-medium">Modelo:</span> {selectedDriver.vehicle.model}</p>
                      <p><span className="font-medium">Placa:</span> {selectedDriver.vehicle.plate}</p>
                      <p><span className="font-medium">Ano:</span> {selectedDriver.vehicle.year}</p>
                      <p><span className="font-medium">Cor:</span> {selectedDriver.vehicle.color}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedDriver.documents && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Documentos</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedDriver.documents.cnh && (
                      <div>
                        <p className="text-sm font-medium mb-1">CNH</p>
                        <img
                          src={selectedDriver.documents.cnh}
                          alt="CNH"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    {selectedDriver.documents.photo && (
                      <div>
                        <p className="text-sm font-medium mb-1">Foto</p>
                        <img
                          src={selectedDriver.documents.photo}
                          alt="Foto"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    {selectedDriver.documents.criminalRecord && (
                      <div>
                        <p className="text-sm font-medium mb-1">Antecedentes Criminais</p>
                        <img
                          src={selectedDriver.documents.criminalRecord}
                          alt="Antecedentes Criminais"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedDriver(null);
                  }}
                  className="btn-secondary"
                >
                  Fechar
                </button>
                {selectedDriver.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedDriver.id, 'approved');
                        setShowDetailsModal(false);
                        setSelectedDriver(null);
                      }}
                      className="btn-success"
                    >
                      Aprovar Motorista
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedDriver.id, 'rejected');
                        setShowDetailsModal(false);
                        setSelectedDriver(null);
                      }}
                      className="btn-error"
                    >
                      Rejeitar Motorista
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers; 