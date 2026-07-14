'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');

  const fetchSchools = async () => {
    try {
      const res = await axios.get(`${API_URL}/schools`);
      setSchools(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      let endpoint = isLogin ? '/auth/login' : '/auth/register';
      let payload: any = { email, password };
      if (!isLogin) {
        payload = { ...payload, firstName, lastName };
      }
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      setToken(res.data.token);
      setUser(res.data.user);
      setMessage(`✅ ${isLogin ? 'Connecté' : 'Inscrit'} avec succès !`);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
    } catch (err: any) {
      setMessage(`❌ Erreur : ${err.response?.data?.error || 'Vérifie ta connexion'}`);
    }
  };

  if (token) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
        <div className="max-w-4xl w-full bg-white p-8 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">🎓 Bienvenue, {user?.firstName} !</h1>
          <p className="text-gray-600 mb-6">Email : {user?.email}</p>
          <button
            onClick={() => { setToken(null); setUser(null); }}
            className="text-sm bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Se déconnecter
          </button>

          <hr className="my-8" />
          <h2 className="text-2xl font-semibold mb-4">🏫 Liste des écoles et offres</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {schools.map((school) => (
              <div key={school.id} className="border p-4 rounded-lg shadow-sm bg-gray-50">
                <h3 className="text-xl font-bold text-gray-800">{school.name}</h3>
                <p className="text-sm text-gray-600">{school.description}</p>
                <p className="text-sm text-gray-500">📍 {school.city}</p>
                <div className="mt-3">
                  <p className="font-semibold text-sm">Offres disponibles :</p>
                  {school.offers.map((offer: any) => (
                    <div key={offer.id} className="ml-2 text-sm bg-white p-2 rounded mt-1 shadow-sm">
                      <span className="font-medium">{offer.title}</span> - {offer.diploma} <br />
                      <span className="text-blue-600">💰 {offer.tuitionFees.toLocaleString()} Ar</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          🚀 GET - POC
        </h1>
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`px-4 py-2 rounded-lg ${isLogin ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Connexion
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`px-4 py-2 rounded-lg ${!isLogin ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Prénom"
                className="w-full p-2 border rounded"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Nom"
                className="w-full p-2 border rounded"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            className="w-full p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
          >
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
        {message && <p className="mt-4 text-center text-sm">{message}</p>}
        <p className="mt-6 text-xs text-gray-400 text-center">
          Le backend doit tourner sur le port 3001
        </p>
      </div>
    </main>
  );
}
