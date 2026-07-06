import React, { useState } from 'react';
import { useApp, MeetingRoom } from '../context/AppContext';
import { 
  Building2, 
  Users, 
  MapPin, 
  Crown, 
  Info, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface MeetingRoomsProps {
  setActivePage: (page: string) => void;
}

export const MeetingRooms: React.FC<MeetingRoomsProps> = ({ setActivePage }) => {
  const { rooms, bookings, tasks } = useApp();

  const [selectedRoomDetail, setSelectedRoomDetail] = useState<MeetingRoom | null>(null);
  
  // Gallery Lightbox State
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [galleryRoomName, setGalleryRoomName] = useState<string>('');

  const vipRooms = rooms.filter(r => r.isVip);
  const standardRooms = rooms.filter(r => !r.isVip);

  // Helper to get room images list
  const getRoomImages = (room: MeetingRoom): string[] => {
    if (room.images && room.images.length > 0) {
      return room.images;
    }
    if (room.coverImage) {
      return [room.coverImage];
    }
    // Fallback default stock room photos
    return [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=1200&q=80'
    ];
  };

  const openGallery = (room: MeetingRoom, initialIndex: number = 0) => {
    const images = getRoomImages(room);
    setGalleryImages(images);
    setGalleryIndex(initialIndex);
    setGalleryRoomName(room.name);
    setZoomScale(1);
    setIsGalleryOpen(true);
  };

  const handleNextImage = () => {
    setGalleryIndex((prev) => (prev + 1) % galleryImages.length);
    setZoomScale(1);
  };

  const handlePrevImage = () => {
    setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    setZoomScale(1);
  };

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(prev + 0.3, 3));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => Math.max(prev - 0.3, 0.6));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  const renderRoomCard = (room: MeetingRoom) => {
    const images = getRoomImages(room);
    const coverPhoto = room.coverImage || images[0];

    return (
      <div 
        key={room.id}
        className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
      >
        <div>
          {/* Room Image Thumbnail */}
          <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-950 cursor-pointer">
            <img 
              src={coverPhoto} 
              alt={room.name}
              onClick={() => openGallery(room, 0)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-60"></div>
            
            {/* VIP / Standard Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              {room.isVip ? (
                <span className="bg-amber-500/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  <span>VIP Room</span>
                </span>
              ) : (
                <span className="bg-slate-800/80 text-slate-200 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm">
                  ห้องประชุมทั่วไป
                </span>
              )}
            </div>

            {/* Photo Counter Badge */}
            <button 
              onClick={() => openGallery(room, 0)}
              className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ZoomIn className="h-3 w-3" />
              <span>{images.length} รูปภาพ</span>
            </button>
          </div>

          {/* Room Information */}
          <div className="p-5 space-y-3 text-left">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white group-hover:text-enterprise-500 transition-colors flex items-center gap-1.5">
                <span>{room.name}</span>
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>ความจุ {room.capacity} ที่นั่ง</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{room.building} ชั้น {room.floor}</span>
                </span>
              </div>
            </div>

            {/* Amenities Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {room.amenities.slice(0, 4).map((amenity, i) => (
                <span 
                  key={i}
                  className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50"
                >
                  {amenity}
                </span>
              ))}
              {room.amenities.length > 4 && (
                <span className="text-[10px] text-slate-400 font-semibold self-center">
                  +{room.amenities.length - 4} เพิ่มเติม
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={() => setSelectedRoomDetail(room)}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>ดูรายละเอียด</span>
          </button>

          <button
            onClick={() => setActivePage('Book a Room')}
            className="py-2 px-4 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <span>จองห้องนี้</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 text-left">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-enterprise-500" />
            <span>รายการห้องประชุมและสถานที่</span>
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">เรียกดูรายละเอียดห้องประชุม สิ่งอำนวยความสะดวก และรูปภาพสถานที่</p>
        </div>

        <button 
          onClick={() => setActivePage('Book a Room')}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer shadow-sm"
        >
          <span>ลงภารกิจ / จองห้องประชุม</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* SECTION 1: VIP ROOMS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">ห้องประชุมระดับ VIP (VIP Executive Meeting Rooms)</h3>
              <p className="text-[11px] text-slate-400">ห้องรับรองผู้บริหารระดับสูง ต้องการอนุมัติสิทธิ์ก่อนใช้งาน</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/30">
            {vipRooms.length} ห้อง
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vipRooms.map(renderRoomCard)}
        </div>
      </div>

      {/* SECTION 2: STANDARD ROOMS */}
      <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-enterprise-100 dark:bg-enterprise-950/40 flex items-center justify-center text-enterprise-600 dark:text-enterprise-400 border border-enterprise-200/60 dark:border-enterprise-900/40">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">ห้องประชุมทั่วไป (Standard Meeting Rooms)</h3>
              <p className="text-[11px] text-slate-400">สำหรับประชุมสัมมนา ปฏิบัติงานประจำ และการประชุมฝ่ายงาน</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
            {standardRooms.length} ห้อง
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {standardRooms.map(renderRoomCard)}
        </div>
      </div>

      {/* ROOM DETAIL MODAL */}
      {selectedRoomDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 text-left flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="relative h-56 w-full bg-slate-950">
              <img 
                src={selectedRoomDetail.coverImage || getRoomImages(selectedRoomDetail)[0]} 
                alt={selectedRoomDetail.name} 
                className="h-full w-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
              
              <button 
                onClick={() => setSelectedRoomDetail(null)} 
                className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="absolute bottom-4 left-6 right-6">
                {selectedRoomDetail.isVip && (
                  <span className="bg-amber-500 text-white px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1">
                    <Crown className="h-3 w-3" /> VIP Room
                  </span>
                )}
                <h3 className="text-xl font-bold text-white">{selectedRoomDetail.name}</h3>
                <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                  <span>ความจุ {selectedRoomDetail.capacity} ที่นั่ง</span>
                  <span>•</span>
                  <span>{selectedRoomDetail.building} ชั้น {selectedRoomDetail.floor}</span>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Photo Gallery Thumbnails */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">รูปภาพห้องประชุม</h4>
                  <button 
                    onClick={() => {
                      const room = selectedRoomDetail;
                      setSelectedRoomDetail(null);
                      openGallery(room, 0);
                    }}
                    className="text-xs text-enterprise-500 font-semibold hover:underline cursor-pointer"
                  >
                    เปิดแกลเลอรี่ซูมขยาย
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {getRoomImages(selectedRoomDetail).map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        const room = selectedRoomDetail;
                        setSelectedRoomDetail(null);
                        openGallery(room, idx);
                      }}
                      className="h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer hover:opacity-90 transition-all relative group"
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">สิ่งอำนวยความสะดวกประจำห้อง</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRoomDetail.amenities.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
              <button
                onClick={() => setSelectedRoomDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => {
                  setSelectedRoomDetail(null);
                  setActivePage('Book a Room');
                }}
                className="px-5 py-2 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                ลงภารกิจจองห้องนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE LIGHTBOX GALLERY MODAL WITH ZOOM */}
      {isGalleryOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          {/* Top Control Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-50">
            <div>
              <h3 className="text-sm font-bold">{galleryRoomName}</h3>
              <p className="text-[11px] text-slate-400">รูปภาพที่ {galleryIndex + 1} จาก {galleryImages.length}</p>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 p-1.5 rounded-2xl backdrop-blur-md">
              <button
                onClick={handleZoomIn}
                title="ซูมขยาย"
                className="p-2 rounded-xl hover:bg-slate-800 text-white cursor-pointer transition-all"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleZoomOut}
                title="ย่อขนาด"
                className="p-2 rounded-xl hover:bg-slate-800 text-white cursor-pointer transition-all"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={handleResetZoom}
                title="รีเซ็ตขนาด"
                className="p-2 rounded-xl hover:bg-slate-800 text-white cursor-pointer transition-all text-xs font-semibold px-2.5"
              >
                <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
                <span>{Math.round(zoomScale * 100)}%</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>
              <button
                onClick={() => setIsGalleryOpen(false)}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Previous Button */}
          {galleryImages.length > 1 && (
            <button
              onClick={handlePrevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-slate-900/70 border border-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Next Button */}
          {galleryImages.length > 1 && (
            <button
              onClick={handleNextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-slate-900/70 border border-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Image Display Area with Zoom Transform */}
          <div className="w-full h-full flex items-center justify-center overflow-auto p-12">
            <img
              src={galleryImages[galleryIndex]}
              alt={galleryRoomName}
              className="max-h-[80vh] max-w-[85vw] object-contain transition-transform duration-200 select-none shadow-2xl rounded-2xl"
              style={{ transform: `scale(${zoomScale})` }}
            />
          </div>

          {/* Bottom Thumbnail Navigation Strip */}
          {galleryImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-slate-900/80 border border-slate-800 p-2 rounded-2xl backdrop-blur-md max-w-[90vw] overflow-x-auto">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setGalleryIndex(idx);
                    setZoomScale(1);
                  }}
                  className={`h-14 w-20 rounded-xl overflow-hidden cursor-pointer transition-all border-2 flex-shrink-0 ${
                    idx === galleryIndex ? 'border-enterprise-500 scale-105 shadow-md' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
