import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../utils/firebase';
import { RiAddLine, RiEditLine, RiDeleteBinLine } from 'react-icons/ri';

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
}

const Sponsors = () => {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const sponsorsRef = collection(db, 'sponsors');
      const snapshot = await getDocs(sponsorsRef);
      const sponsorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sponsor[];
      setSponsors(sponsorsList);
    } catch (error) {
      console.error('Erro ao carregar patrocinadores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogo(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !logo) return;

    try {
      setLoading(true);

      // Upload da logo
      const logoRef = ref(storage, `sponsors/${Date.now()}-${logo.name}`);
      await uploadBytes(logoRef, logo);
      const logoUrl = await getDownloadURL(logoRef);

      if (editingSponsor) {
        // Atualizar patrocinador existente
        const sponsorRef = doc(db, 'sponsors', editingSponsor.id);
        await updateDoc(sponsorRef, {
          name,
          logoUrl
        });
      } else {
        // Adicionar novo patrocinador
        await addDoc(collection(db, 'sponsors'), {
          name,
          logoUrl
        });
      }

      // Resetar form
      setName('');
      setLogo(null);
      setEditingSponsor(null);
      await loadSponsors();
    } catch (error) {
      console.error('Erro ao salvar patrocinador:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sponsor: Sponsor) => {
    if (!window.confirm('Tem certeza que deseja excluir este patrocinador?')) return;

    try {
      setLoading(true);
      
      // Deletar documento do Firestore
      await deleteDoc(doc(db, 'sponsors', sponsor.id));
      
      // Deletar logo do Storage
      const logoRef = ref(storage, sponsor.logoUrl);
      await deleteObject(logoRef);

      await loadSponsors();
    } catch (error) {
      console.error('Erro ao deletar patrocinador:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setName(sponsor.name);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Patrocinadores</h1>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome do Patrocinador
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
              Logo
            </label>
            <input
              type="file"
              id="logo"
              accept="image/*"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              required={!editingSponsor}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors duration-200"
          >
            <RiAddLine className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:rotate-180" />
            {editingSponsor ? 'Atualizar' : 'Adicionar'} Patrocinador
          </button>
        </div>
      </form>

      {/* Lista de Patrocinadores */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando patrocinadores...</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <ul className="divide-y divide-gray-200">
            {sponsors.map((sponsor) => (
              <li key={sponsor.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    className="h-12 w-12 object-contain"
                  />
                  <span className="font-medium">{sponsor.name}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(sponsor)}
                    className="p-2 text-gray-500 hover:text-primary-600 transition-colors duration-200 group"
                  >
                    <RiEditLine className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  </button>
                  <button
                    onClick={() => handleDelete(sponsor)}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors duration-200 group"
                  >
                    <RiDeleteBinLine className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
                  </button>
                </div>
              </li>
            ))}
            {sponsors.length === 0 && (
              <li className="p-4 text-center text-gray-500">
                Nenhum patrocinador cadastrado.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Sponsors; 