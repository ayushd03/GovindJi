import React, { useState } from 'react';
import { Package, MapPin, Clock, CheckCircle, Copy, Check } from 'lucide-react';

/**
 * DeliveryTracker Component - Displays shipment tracking information
 *
 * Shows AWB number, current status, tracking timeline, and estimated delivery
 */
const DeliveryTracker = ({ shipment }) => {
  const [copied, setCopied] = useState(false);

  if (!shipment) {
    return null;
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'PENDING': 'bg-gray-100 text-gray-800',
      'PICKUP_SCHEDULED': 'bg-blue-100 text-blue-800',
      'MANIFESTED': 'bg-indigo-100 text-indigo-800',
      'IN_TRANSIT': 'bg-yellow-100 text-yellow-800',
      'OUT_FOR_DELIVERY': 'bg-orange-100 text-orange-800',
      'DELIVERED': 'bg-green-100 text-green-800',
      'RTO': 'bg-red-100 text-red-800',
      'CANCELLED': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      'PENDING': 'Shipment Created',
      'PICKUP_SCHEDULED': 'Pickup Scheduled',
      'MANIFESTED': 'Manifested',
      'IN_TRANSIT': 'In Transit',
      'OUT_FOR_DELIVERY': 'Out for Delivery',
      'DELIVERED': 'Delivered',
      'RTO': 'Return to Origin',
      'CANCELLED': 'Cancelled'
    };
    return statusLabels[status] || status;
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const trackingEvents = shipment.shipment_tracking_events || [];
  const sortedEvents = [...trackingEvents].sort((a, b) =>
    new Date(b.scan_datetime) - new Date(a.scan_datetime)
  );

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mt-4 border border-blue-200 shadow-sm">
      {/* Header with AWB Number */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Tracking Number</p>
            <p className="font-mono font-semibold text-lg text-gray-900">{shipment.awb_number}</p>
          </div>
        </div>
        <button
          onClick={() => copyToClipboard(shipment.awb_number)}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Current Status */}
      <div className="mb-6">
        <div className={`inline-flex items-center px-4 py-2 rounded-full ${getStatusColor(shipment.status)}`}>
          <span className="font-semibold">{getStatusLabel(shipment.status)}</span>
        </div>
        {shipment.current_location && (
          <div className="flex items-center mt-3 text-gray-700">
            <MapPin className="w-4 h-4 mr-2" />
            <span className="text-sm">Current Location: <span className="font-medium">{shipment.current_location}</span></span>
          </div>
        )}
      </div>

      {/* Estimated Delivery */}
      {shipment.estimated_delivery_date && shipment.status !== 'DELIVERED' && (
        <div className="mb-6 bg-white border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Estimated Delivery</p>
              <p className="font-semibold text-gray-900">
                {new Date(shipment.estimated_delivery_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivered Confirmation */}
      {shipment.status === 'DELIVERED' && shipment.actual_delivery_date && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-green-700 font-medium">Delivered Successfully</p>
              <p className="text-sm text-green-600">
                {formatDateTime(shipment.actual_delivery_date)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Timeline */}
      {sortedEvents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <span className="bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-xs">●</span>
            </span>
            Tracking History
          </h3>
          <div className="space-y-4">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-start space-x-4 relative"
              >
                {/* Timeline connector */}
                {index < sortedEvents.length - 1 && (
                  <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-blue-300"></div>
                )}

                {/* Event marker */}
                <div className={`w-5 h-5 rounded-full flex-shrink-0 z-10 mt-1 ${
                  index === 0 ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-gray-300'
                }`}></div>

                {/* Event details */}
                <div className="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-900">{event.status}</p>
                    <span className="text-xs text-gray-500">{formatDateTime(event.scan_datetime)}</span>
                  </div>
                  {event.location && (
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {event.location}
                    </p>
                  )}
                  {event.instructions && (
                    <p className="text-sm text-gray-500 mt-2 italic">{event.instructions}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracking Link */}
      {shipment.awb_number && (
        <div className="mt-6 pt-4 border-t border-blue-200">
          <a
            href={`https://www.delhivery.com/track/package/${shipment.awb_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          >
            Track on Delhivery Website
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
};

export default DeliveryTracker;
