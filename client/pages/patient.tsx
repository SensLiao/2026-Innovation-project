import { useState, useEffect } from "react";
import { Search, Edit, Trash } from "lucide-react";

const tabs = ["Patient", "Segmentation", "Report", "History"];

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  profilephoto: string;
}

interface ApiResponse {
  success: boolean;
  data: Patient[];
}

export default function Patient() {
  const [activeTab, setActiveTab] = useState("Patient");
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('/api/patients');
        const data: ApiResponse = await response.json();
        
        if (data.success) {
          setPatients(data.data);
        } else {
          console.error('Failed to fetch patients');
        }
      } catch (error) {
        console.error('Error fetching patients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-24 py-4 lg:py-12">
        <div className="text-5xl lg:text-7xl font-bold text-black">
          LOGO
        </div>
        
        <div className="flex items-center gap-4 lg:gap-8">
          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 lg:px-4 py-1 text-lg lg:text-2xl font-bold rounded-t-md border-b-2 transition-colors ${
                  activeTab === tab
                    ? "text-medical-text border-medical-text"
                    : "text-gray-500 border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          {/* User Avatar */}
          <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/1873c63e055ec36ac9214730f08e73c466bf1b05?width=200" 
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* Background decorative image */}
      <div className="absolute -left-12 lg:-left-48 top-0 w-96 h-96 lg:w-[570px] lg:h-[570px] opacity-20">
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/153762f462c29bd21e2082a1e146a1b46f6edda9?width=1140"
          alt="Background decoration"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main Content Section */}
      <div>
        <div>
          <div className="flex gap-5 max-md:flex-col max-md:gap-0">
            <div className="flex flex-col w-6/12 max-md:ml-0 max-md:w-full">
              <h1 className="text-4xl lg:text-7xl font-bold text-medical-blue text-center leading-tight my-auto">
                Name of the App
              </h1>
              <p className="text-lg lg:text-2xl font-bold text-medical-blue text-center mb-auto">
                ................. Description ...........
              </p>
              <div className="mb-8 px-6 lg:px-0"></div>
            </div>
            <div className="flex flex-col ml-5 w-6/12 max-md:ml-0 max-md:w-full">
              <img
                src="https://api.builder.io/api/v1/image/assets/TEMP/af25c6f3c6a6445f6d930260ba57eaec03adbeca?width=1608"
                alt="Medical interface illustration"
                className="w-full max-w-3xl h-auto aspect-[3/2] object-cover rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="relative z-10"></div>

        <div className="lg:w-2/3 lg:pl-8">

          {/* Mobile Navigation Tabs */}
          <div className="md:hidden flex items-center justify-center mb-6 px-6">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === tab
                      ? "bg-white text-medical-text shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6 px-6 lg:px-0">
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
              <input
                type="text"
                placeholder="Search ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-search-border rounded-lg text-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-blue focus:border-transparent"
              />
            </div>
          </div>

          {/* Patient Data Table */}
          <div className="px-6 lg:px-0 max-w-full overflow-x-auto">
            <div className="bg-white rounded-lg overflow-hidden min-w-full">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-5 py-4 bg-white min-w-[1000px] lg:min-w-full">
                <div className="text-gray-500 font-medium text-base w-16">ID</div>
                <div className="text-black font-medium text-base flex-1 min-w-[300px]">Patient Name</div>
                <div className="text-black font-medium text-base w-24">Age</div>
                <div className="text-black font-medium text-base w-20">Gender</div>
                <div className="text-black font-medium text-base text-center w-28">Phone</div>
                <div className="text-black font-medium text-base w-24 text-center">Email</div>
                <div className="text-black font-medium text-base text-center w-32">Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-table-border">
                {loading ? (
                  <div className="py-8 text-center text-gray-500">Loading patients...</div>
                ) : patients.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">No patients found</div>
                ) : (
                  patients.map((patient) => (
                    <div key={patient.id} className="grid grid-cols-7 gap-5 py-4 hover:bg-gray-50 transition-colors border-t border-table-border min-w-[1000px] lg:min-w-full">
                      <div className="text-gray-500 text-base w-16">{patient.id}</div>
                      <div className="text-black text-base font-medium flex-1 min-w-[300px]">{patient.name}</div>
                      <div className="flex items-center w-24">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg border border-tag-border bg-tag-bg text-xs font-semibold text-black">
                          {patient.age}
                        </span>
                      </div>
                      <div className="flex items-center w-20">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg border border-tag-border bg-tag-bg text-xs font-semibold text-black">
                          {patient.gender}
                        </span>
                      </div>
                      <div className="text-gray-500 text-base text-center w-28">{patient.phone}</div>
                      <div className="text-black text-base font-medium w-24 text-center">{patient.email}</div>
                      <div className="flex items-center justify-center gap-2 w-32">
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <Edit className="h-6 w-6 text-gray-700" strokeWidth={2} />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <Trash className="h-6 w-6 text-gray-700 opacity-80" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
