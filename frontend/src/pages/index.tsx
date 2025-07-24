import React, { useState } from 'react';
import { Search, Edit, Trash2, Plus, User, BarChart3, FileText, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Patient {
  pid: number;
  name: string;
  age: number;
  gender: 'Male' | 'Female';
  registeredDate: string;
  email: string;
}

// change this to database patients
const samplePatients: Patient[] = [
  { pid: 1, name: 'Emily Carter', age: 28, gender: 'Female', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 2, name: 'James Nguyen', age: 34, gender: 'Male', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 3, name: 'Sophia Martinez', age: 43, gender: 'Female', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 4, name: 'Liam Johnson', age: 19, gender: 'Male', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 5, name: 'Olivia Wang', age: 26, gender: 'Female', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 6, name: 'Benjamin Patel', age: 27, gender: 'Male', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 7, name: 'Teresa Chen', age: 21, gender: 'Female', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 8, name: 'Karen Hu', age: 21, gender: 'Female', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 9, name: 'Sens Liao', age: 20, gender: 'Male', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
  { pid: 10, name: 'Steven Cai', age: 22, gender: 'Male', registeredDate: 'Dec 5', email: 'Test@gmail.com' },
];

const navigationTabs = [
  { id: 'patient', label: 'Patient', icon: User, active: true },
  { id: 'segmentation', label: 'Segmentation', icon: BarChart3, active: false },
  { id: 'report', label: 'Report', icon: FileText, active: false },
  { id: 'history', label: 'History', icon: History, active: false },
];

export default function Index() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('patient');

  const filteredPatients = samplePatients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.pid.toString().includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="h-[142px] md:h-[142px] sm:h-[120px] bg-[#C8D9E8] border-b border-[#E0E0E0] relative">
        {/* Logo */}
        <div className="absolute left-4 md:left-[106px] top-4 md:top-[33px]">
          <h1 className="text-3xl md:text-7xl font-bold text-black tracking-[-1px] md:tracking-[-2.16px] leading-[32px] md:leading-[86.4px] font-inter">
            LOGO
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="absolute left-4 md:left-[399px] top-16 md:top-[54px] flex items-start overflow-x-auto">
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-1 md:px-3 py-1 text-lg md:text-4xl font-normal leading-[22px] md:leading-[44px] font-roboto border-b-2 whitespace-nowrap ${
                  tab.active
                    ? 'text-[#303030] border-[#303030]'
                    : 'text-[#767676] border-[#B2B2B2] opacity-60'
                }`}
              >
                <Icon className="w-6 h-6 md:w-[52px] md:h-[52px] mr-1 md:mr-3" strokeWidth={1} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Avatar */}
        <div className="absolute right-4 md:right-[34px] top-4 md:top-[22px]">
          <div className="w-[60px] h-[60px] md:w-[99px] md:h-[97px] rounded-full bg-[#F7F7F7] flex items-center justify-center overflow-hidden">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/16b9f4a901077cb848cac69a866b2c97f10c3e0d?width=198"
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-[88px] pt-4 md:pt-[67px]">
        {/* Search Bar */}
        <div className="mb-6 md:mb-[90px]">
          <div className="relative w-full md:w-[740px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#828282] w-6 h-6" />
            <Input
              type="text"
              placeholder="Search ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-[55px] w-full rounded-lg border border-[#E0E0E0] text-base placeholder:text-[#828282] font-inter focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Add Button */}
        <Button
          className="absolute right-4 md:right-[103px] top-[180px] md:top-[225px] p-0 w-[30px] h-[30px] bg-transparent hover:bg-gray-100"
          variant="ghost"
          size="icon"
        >
          <Plus className="w-[30px] h-[30px] text-[#1D1B20]" />
        </Button>

        {/* Patient Table */}
        <div className="w-full max-w-[1230px] overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="border-none">
                <TableHead className="w-[70px] text-[#828282] font-medium text-sm md:text-base font-inter px-0">PID</TableHead>
                <TableHead className="w-[200px] md:w-[487px] text-black font-medium text-sm md:text-base font-inter px-2 md:px-5">Name</TableHead>
                <TableHead className="w-[80px] md:w-[120px] text-black font-medium text-sm md:text-base font-inter px-2 md:px-5">Age</TableHead>
                <TableHead className="w-[80px] md:w-[64px] text-black font-medium text-sm md:text-base font-inter px-2 md:px-5">Gender</TableHead>
                <TableHead className="w-[100px] text-black font-medium text-sm md:text-base font-inter text-center px-2 md:px-5">Registered Date</TableHead>
                <TableHead className="w-[140px] text-black font-medium text-sm md:text-base font-inter px-2 md:px-5">Email</TableHead>
                <TableHead className="w-[84px] text-black font-medium text-sm md:text-base font-inter text-center px-2 md:px-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient, index) => (
                <TableRow key={patient.pid} className="border-t border-[#E0E0E0] h-[56px]">
                  <TableCell className="text-[#828282] font-medium text-sm md:text-base font-inter px-0">
                    {patient.pid}
                  </TableCell>
                  <TableCell className="text-black font-medium text-sm md:text-base font-inter px-2 md:px-5">
                    {patient.name}
                  </TableCell>
                  <TableCell className="px-2 md:px-5">
                    <Badge variant="outline" className="bg-white border border-[#E0E0E0] text-black font-bold text-xs px-2 py-1.5 rounded-lg font-inter">
                      {patient.age}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 md:px-5">
                    <Badge variant="outline" className="bg-white border border-[#E0E0E0] text-black font-bold text-xs px-2 py-1.5 rounded-lg font-inter">
                      {patient.gender}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#828282] text-sm md:text-base text-center font-inter px-2 md:px-5">
                    {patient.registeredDate}
                  </TableCell>
                  <TableCell className="text-black font-medium text-sm md:text-base text-center font-inter px-2 md:px-5">
                    {patient.email}
                  </TableCell>
                  <TableCell className="text-center px-2 md:px-5">
                    {/* Only show action buttons for rows 1, 2, 3, 4, 7, 8, 9, 10 to match design */}
                    {[1, 2, 3, 4, 7, 8, 9, 10].includes(patient.pid) && (
                      <div className="flex items-center justify-center gap-1 md:gap-2">
                        <Button variant="ghost" size="icon" className="p-0 h-auto w-auto hover:bg-gray-100">
                          <Edit className="w-6 h-6 md:w-[30px] md:h-[30px] text-[#1E1E1E]" strokeWidth={1.5} />
                        </Button>
                        <Button variant="ghost" size="icon" className="p-0 h-auto w-auto hover:bg-gray-100 opacity-80">
                          <Trash2 className="w-7 h-7 md:w-[35px] md:h-[35px] text-[#1E1E1E]" strokeWidth={1.5} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
