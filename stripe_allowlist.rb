#!/usr/bin/env ruby
# frozen_string_literal: true

# Stripe Allowlist Script
# Updates metadata on Stripe objects to allow NetSuite integration
#
# Usage: ruby stripe_allowlist.rb <input_file>
#
# Input file format (CSV or tab-separated):
#   id,record_type
#   cus_xxxxx,customer
#   in_xxxxx,invoice
#   ch_xxxxx,charge
#
# Environment variable required:
#   STRIPE_SECRET_KEY - Your Stripe secret API key

require 'bundler/inline'

gemfile do
  source 'https://rubygems.org'
  gem 'stripe', '~> 10.0'
end

require 'csv'
require 'stripe'

class StripeAllowlist
  VALID_RECORD_TYPES = %w[customer invoice charge].freeze
  METADATA_KEY = 'netsuite_allow_integration'
  METADATA_VALUE = 'true'

  def initialize(input_file)
    @input_file = input_file
    @results = { success: [], failed: [] }
    setup_stripe
  end

  def run
    validate_file!
    records = parse_input_file

    puts "Found #{records.length} records to process"
    puts "-" * 50

    records.each_with_index do |record, index|
      process_record(record, index + 1, records.length)
    end

    print_summary
  end

  private

  def setup_stripe
    api_key = ENV['STRIPE_SECRET_KEY']

    if api_key.nil? || api_key.empty?
      abort "Error: STRIPE_SECRET_KEY environment variable is not set.\n" \
            "Please set it with: export STRIPE_SECRET_KEY=sk_..."
    end

    Stripe.api_key = api_key
  end

  def validate_file!
    unless File.exist?(@input_file)
      abort "Error: File '#{@input_file}' not found."
    end
  end

  def parse_input_file
    records = []

    File.readlines(@input_file).each_with_index do |line, line_num|
      next if line_num.zero? && line.downcase.include?('id') # Skip header

      line = line.strip
      next if line.empty?

      # Support both CSV and tab-separated formats
      parts = line.include?(',') ? line.split(',') : line.split(/\s+/)

      if parts.length < 2
        puts "Warning: Skipping line #{line_num + 1} - invalid format: #{line}"
        next
      end

      id = parts[0].strip
      record_type = parts[1].strip.downcase

      unless VALID_RECORD_TYPES.include?(record_type)
        puts "Warning: Skipping line #{line_num + 1} - invalid record type '#{record_type}'. " \
             "Valid types: #{VALID_RECORD_TYPES.join(', ')}"
        next
      end

      records << { id: id, type: record_type, line: line_num + 1 }
    end

    records
  end

  def process_record(record, current, total)
    print "[#{current}/#{total}] Updating #{record[:type]} #{record[:id]}... "

    begin
      update_metadata(record[:id], record[:type])
      puts "✓ Success"
      @results[:success] << record
    rescue Stripe::InvalidRequestError => e
      puts "✗ Failed - #{e.message}"
      @results[:failed] << record.merge(error: e.message)
    rescue Stripe::AuthenticationError => e
      abort "\nAuthentication failed. Please check your STRIPE_SECRET_KEY.\nError: #{e.message}"
    rescue Stripe::APIConnectionError => e
      puts "✗ Failed - Connection error: #{e.message}"
      @results[:failed] << record.merge(error: "Connection error: #{e.message}")
    rescue Stripe::StripeError => e
      puts "✗ Failed - #{e.message}"
      @results[:failed] << record.merge(error: e.message)
    end
  end

  def update_metadata(id, record_type)
    metadata = { METADATA_KEY => METADATA_VALUE }

    case record_type
    when 'customer'
      Stripe::Customer.update(id, { metadata: metadata })
    when 'invoice'
      Stripe::Invoice.update(id, { metadata: metadata })
    when 'charge'
      Stripe::Charge.update(id, { metadata: metadata })
    end
  end

  def print_summary
    puts "\n" + "=" * 50
    puts "SUMMARY"
    puts "=" * 50
    puts "Total processed: #{@results[:success].length + @results[:failed].length}"
    puts "Successful: #{@results[:success].length}"
    puts "Failed: #{@results[:failed].length}"

    if @results[:failed].any?
      puts "\nFailed records:"
      @results[:failed].each do |record|
        puts "  - #{record[:type]} #{record[:id]} (line #{record[:line]}): #{record[:error]}"
      end
    end
  end
end

# Main execution
if ARGV.empty?
  puts "Stripe Allowlist Script"
  puts "-" * 50
  puts "Updates Stripe objects with metadata: #{StripeAllowlist::METADATA_KEY}=true"
  puts
  puts "Usage: ruby #{$PROGRAM_NAME} <input_file>"
  puts
  puts "Input file format (CSV or tab-separated):"
  puts "  id,record_type"
  puts "  cus_xxxxx,customer"
  puts "  in_xxxxx,invoice"
  puts "  ch_xxxxx,charge"
  puts
  puts "Supported record types: customer, invoice, charge"
  puts
  puts "Environment variable required:"
  puts "  STRIPE_SECRET_KEY - Your Stripe secret API key"
  exit 1
end

StripeAllowlist.new(ARGV[0]).run
